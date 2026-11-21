import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, Repository } from 'typeorm';
import { WorkLog, type WorkShift, type WorkStatus } from '../entities/work-log.entity.js';

/**
 * ชั่วโมงเต็มของแต่ละกะ ตามวันในสัปดาห์ (0 = อาทิตย์ … 6 = เสาร์) · 0 = ไม่มีกะนั้น
 * เสาร์ 3+3 · อาทิตย์–พฤหัส 9+3 · ศุกร์ 9 (ไม่มีกลางคืน) → รวม 75 ชม./สัปดาห์
 */
export const SHIFT_HOURS: Record<number, Record<WorkShift, number>> = {
  0: { day: 9, night: 3 },
  1: { day: 9, night: 3 },
  2: { day: 9, night: 3 },
  3: { day: 9, night: 3 },
  4: { day: 9, night: 3 },
  5: { day: 9, night: 0 },
  6: { day: 3, night: 3 },
};

export const SHIFTS: WorkShift[] = ['day', 'night'];
export const SHIFT_LABEL: Record<WorkShift, string> = { day: 'กลางวัน', night: 'กลางคืน' };
/** คำสั่งลงเวลา: สถานะที่เก็บ หรือ clear = ลบแถว (กลับเป็นยังไม่ลง) */
type WorkAction = WorkStatus | 'clear';

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
const WEEK_START_DAY = 6; // สัปดาห์เริ่มวันเสาร์
const TZ = 'Asia/Bangkok';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SaveShiftInput {
  date?: string;
  shift?: string;
  action?: string;
  absent?: string;
  reason?: string;
}

export interface SaveLeaveInput {
  date?: string;
  scope?: string; // day | night | both
  mode?: string; // leave | partial
  absent?: string;
  reason?: string;
}

export interface ShiftView {
  shift: WorkShift;
  label: string;
  full: number;
  status: WorkStatus | 'none';
  absent: number;
  reason: string;
  actual: number;
}

export interface DayView {
  date: string;
  dayName: string;
  label: string;
  isToday: boolean;
  isPast: boolean; // ผ่านมาแล้วหรือวันนี้
  full: number;
  actual: number;
  shifts: ShiftView[];
}

// ---- วันที่: string YYYY-MM-DD + คำนวณแบบ UTC ล้วน กันเพี้ยนเรื่อง timezone ----
const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toIso(x);
};
export const isValidDate = (d: string) => ISO_DATE.test(d) && toIso(toUtc(d)) === d;
const shiftHoursOf = (date: string) => SHIFT_HOURS[toUtc(date).getUTCDay()];

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // en-CA = YYYY-MM-DD
}

export function weekStartOf(date: string): string {
  const dow = toUtc(date).getUTCDay();
  return addDays(date, -((dow - WEEK_START_DAY + 7) % 7));
}

const thaiShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dateLabel = (d: string) => `${DAY_NAMES[toUtc(d).getUTCDay()]} ${thaiShort.format(toUtc(d))}`;

const actualOf = (status: WorkStatus | 'none', full: number, absent: number) =>
  status === 'work' ? full : status === 'partial' ? Math.max(0, full - absent) : 0;

@Injectable()
export class WorktimeService {
  constructor(
    @InjectRepository(WorkLog) private readonly logs: Repository<WorkLog>,
    private readonly dataSource: DataSource,
  ) {}

  /** ข้อมูล 7 วัน (แยกกะ) ของสัปดาห์ที่มีวัน `anyDate` อยู่ */
  async getWeek(userId: number, anyDate?: string) {
    const today = todayIso();
    const start = weekStartOf(anyDate && isValidDate(anyDate) ? anyDate : today);
    const end = addDays(start, 6);

    const rows = await this.logs.findBy({ userId, workDate: Between(start, end) });
    const key = (date: string, shift: WorkShift) => `${date}|${shift}`;
    const logBy = new Map(rows.map((r) => [key(r.workDate, r.shift), r]));

    const days: DayView[] = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const hours = shiftHoursOf(date);
      const shifts = SHIFTS.filter((s) => hours[s] > 0).map((s): ShiftView => {
        const row = logBy.get(key(date, s));
        const status = row?.status ?? 'none';
        const absent = row?.status === 'partial' ? row.absentHours : 0;
        return {
          shift: s,
          label: SHIFT_LABEL[s],
          full: hours[s],
          status,
          absent,
          reason: row?.reason ?? '',
          actual: actualOf(status, hours[s], absent),
        };
      });
      return {
        date,
        dayName: DAY_NAMES[toUtc(date).getUTCDay()],
        label: thaiShort.format(toUtc(date)),
        isToday: date === today,
        isPast: date <= today,
        full: shifts.reduce((n, s) => n + s.full, 0),
        actual: shifts.reduce((n, s) => n + s.actual, 0),
        shifts,
      };
    });

    const all = days.flatMap((d) => d.shifts.map((s) => ({ ...s, isPast: d.isPast })));
    const sumBy = (shift: WorkShift) => all.filter((s) => s.shift === shift).reduce((n, s) => n + s.actual, 0);

    return {
      days,
      summary: {
        total: all.reduce((n, s) => n + s.actual, 0),
        fullTotal: all.reduce((n, s) => n + s.full, 0),
        dayTotal: sumBy('day'),
        nightTotal: sumBy('night'),
        leaveCount: all.filter((s) => s.status === 'leave').length,
        pendingCount: all.filter((s) => s.isPast && s.status === 'none').length,
      },
      weekStart: start,
      rangeLabel: `${thaiShort.format(toUtc(start))} – ${thaiShort.format(toUtc(end))}`,
      prevWeek: addDays(start, -7),
      nextWeek: addDays(start, 7),
      isThisWeek: start === weekStartOf(today),
    };
  }

  /** ลงเวลา/แก้ไข 1 กะ (ตาราง work_logs: 1 แถว = 1 คน 1 วัน 1 กะ) */
  async saveShift(userId: number, input: SaveShiftInput): Promise<{ date: string; shift: WorkShift }> {
    const date = (input.date ?? '').trim();
    if (!isValidDate(date)) throw new BadRequestException('วันที่ไม่ถูกต้อง');

    const shift = SHIFTS.find((s) => s === input.shift);
    if (!shift) throw new BadRequestException('กะไม่ถูกต้อง');
    const full = shiftHoursOf(date)[shift];
    if (!full) throw new BadRequestException(`วัน${dateLabel(date)} ไม่มีกะ${SHIFT_LABEL[shift]}`);

    const action = (['work', 'partial', 'leave', 'clear'] as const).find((a) => a === input.action);
    if (!action) throw new BadRequestException('คำสั่งไม่ถูกต้อง');

    const reason = (input.reason ?? '').trim().slice(0, 255) || null;
    let absent = 0;
    if (action === 'partial') {
      absent = Number((input.absent ?? '').trim());
      if (!Number.isFinite(absent) || absent <= 0 || absent > full || Math.round(absent * 2) !== absent * 2) {
        throw new BadRequestException(`ชั่วโมงที่หายไปต้องอยู่ระหว่าง 0.5–${full} (ทีละ 0.5)`);
      }
    }
    if (action === 'leave' && !reason) throw new BadRequestException('ลางานต้องระบุเหตุผล');

    await this.dataSource.transaction((m) =>
      this.apply(m, userId, date, shift, action, absent, action === 'work' ? null : reason),
    );
    return { date, shift };
  }

  /**
   * ลางาน (ปุ่ม "ลางาน" ในคอลัมน์จัดการ)
   * - scope: กะที่ลา (day | night | both = ทุกกะของวันนั้น)
   * - mode: leave = ลาทั้งกะ · partial = ลาบางชั่วโมง (เลือกได้ทีละกะ)
   * - ต้องมีเหตุผลเสมอ · ลาหลายกะบันทึกใน transaction เดียว (สำเร็จทั้งหมดหรือไม่บันทึกเลย)
   */
  async saveLeave(userId: number, input: SaveLeaveInput): Promise<{ date: string; shift?: WorkShift }> {
    const date = (input.date ?? '').trim();
    if (!isValidDate(date)) throw new BadRequestException('วันที่ไม่ถูกต้อง');
    const hours = shiftHoursOf(date);
    const available = SHIFTS.filter((s) => hours[s] > 0);

    const shifts =
      input.scope === 'both' ? available : available.filter((s) => s === input.scope);
    if (!shifts.length) throw new BadRequestException('กรุณาเลือกกะที่จะลา');

    const mode = input.mode === 'partial' ? 'partial' : 'leave';
    if (mode === 'partial' && shifts.length > 1) throw new BadRequestException('ลาบางชั่วโมงเลือกได้ทีละกะ');

    const reason = (input.reason ?? '').trim().slice(0, 255);
    if (!reason) throw new BadRequestException('ลางานต้องระบุเหตุผล');

    let absent = 0;
    if (mode === 'partial') {
      const full = hours[shifts[0]];
      absent = Number((input.absent ?? '').trim());
      if (!Number.isFinite(absent) || absent <= 0 || absent >= full || Math.round(absent * 2) !== absent * 2) {
        throw new BadRequestException(`ลาบางชั่วโมงต้องอยู่ระหว่าง 0.5–${full - 0.5} ชม. (ทีละ 0.5) · ถ้าลาทั้งกะให้เลือก "ลาทั้งกะ"`);
      }
    }

    await this.dataSource.transaction(async (m) => {
      for (const s of shifts) await this.apply(m, userId, date, s, mode, absent, reason);
    });
    return { date, shift: shifts.length === 1 ? shifts[0] : undefined };
  }

  private async apply(
    m: EntityManager,
    userId: number,
    workDate: string,
    shift: WorkShift,
    action: WorkAction,
    absentHours: number,
    reason: string | null,
  ) {
    const logs = m.getRepository(WorkLog);
    if (action === 'clear') {
      await logs.delete({ userId, workDate, shift });
    } else {
      const existing = await logs.findOneBy({ userId, workDate, shift });
      await logs.save(
        logs.merge(existing ?? logs.create({ userId, workDate, shift }), { status: action, absentHours, reason }),
      );
    }
  }
}
