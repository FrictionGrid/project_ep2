import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, Repository } from 'typeorm';
import { Task, type TaskPriority } from '../entities/task.entity.js';
import type { WorkShift } from '../entities/work-log.entity.js';
import { addDays, dateLabel, isValidDate, todayIso, weekStartOf } from '../worktime/worktime.service.js';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal']; // เรียงจากด่วนสุด
const SHIFTS: WorkShift[] = ['day', 'night'];
const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const FRIDAY = 5;
const MAX_TITLE = 200;
const MAX_TEXT = 500;

const thaiShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (d: string) => thaiShort.format(new Date(`${d}T00:00:00Z`));
const dayOfWeek = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

/** ข้อมูลจากฟอร์มเพิ่ม/แก้ไข (ค่าดิบจาก body) */
export interface TaskInput {
  title?: string;
  detail?: string;
  due?: string;
  shift?: string;
  priority?: string;
}

export interface ReviewInput {
  score?: string;
  comment?: string;
}

/** รูปแบบที่หน้าบ้าน (view/tasks/index.ejs) ใช้ */
export interface TaskView {
  id: number;
  title: string;
  detail: string;
  dueDate: string;
  shift: WorkShift;
  priority: TaskPriority;
  done: boolean;
  score: number | null;
  comment: string;
}

const toView = (t: Task): TaskView => ({
  id: t.id,
  title: t.title,
  detail: t.detail ?? '',
  dueDate: t.dueDate,
  shift: t.shift,
  priority: t.priority,
  done: t.isDone,
  score: t.score,
  comment: t.reviewComment ?? '',
});

const optionalText = (v: unknown, label: string) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length > MAX_TEXT) throw new BadRequestException(`${label}ยาวเกิน ${MAX_TEXT} ตัวอักษร`);
  return s || null;
};

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly tasks: Repository<Task>) {}

  /** task ทั้งหมดของสัปดาห์ (เสาร์–ศุกร์) ที่มีวัน `anyDate` อยู่ */
  async getWeek(userId: number, anyDate?: string) {
    const today = todayIso();
    const start = weekStartOf(anyDate && isValidDate(anyDate) ? anyDate : today);
    const end = addDays(start, 6);
    const rows = await this.tasks.find({
      where: { userId, dueDate: Between(start, end) },
      order: { id: 'ASC' },
    });
    return {
      today,
      weekStart: start,
      rangeLabel: `${fmt(start)} – ${fmt(end)}`,
      prevWeek: addDays(start, -7),
      nextWeek: addDays(start, 7),
      weekDays: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, short: DAY_SHORT[dayOfWeek(date)], day: Number(date.slice(8)), label: fmt(date) };
      }),
      tasks: rows.map(toView),
    };
  }

  /**
   * สำหรับ Dashboard: task ที่ยังไม่เสร็จซึ่งครบกำหนดวันนี้หรือค้างจากวันก่อน
   * (ค้างนานสุดขึ้นก่อน → ด่วนกว่าขึ้นก่อน) + สรุป เสร็จ/ทั้งหมด ของสัปดาห์นี้
   */
  async getDashboard(userId: number) {
    const today = todayIso();
    const start = weekStartOf(today);
    const [open, weekTotal, weekDone] = await Promise.all([
      this.tasks.find({ where: { userId, isDone: false, dueDate: LessThanOrEqual(today) } }),
      this.tasks.count({ where: { userId, dueDate: Between(start, addDays(start, 6)) } }),
      this.tasks.count({ where: { userId, isDone: true, dueDate: Between(start, addDays(start, 6)) } }),
    ]);
    const todayTasks = open
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) ||
          PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
          a.id - b.id,
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        shift: t.shift,
        dueDate: t.dueDate,
        overdue: t.dueDate < today,
        dueLabel: dateLabel(t.dueDate),
      }));
    return { todayTasks, weekTasks: { total: weekTotal, done: weekDone } };
  }

  async create(userId: number, input: TaskInput) {
    const task = this.tasks.create({ userId, ...this.parse(input) });
    return this.tasks.save(task);
  }

  async update(userId: number, id: number, input: TaskInput) {
    const task = await this.findOwn(userId, id);
    Object.assign(task, this.parse(input));
    return this.tasks.save(task);
  }

  async toggle(userId: number, id: number) {
    const task = await this.findOwn(userId, id);
    task.isDone = !task.isDone;
    return this.tasks.save(task);
  }

  /** ให้คะแนน 0–10 + คอมเมนต์ (ไม่บังคับ) */
  async review(userId: number, id: number, input: ReviewInput) {
    const raw = typeof input.score === 'string' ? input.score.trim() : '';
    if (!/^(10|[0-9])$/.test(raw)) throw new BadRequestException('กรุณาเลือกคะแนน 0–10');
    const task = await this.findOwn(userId, id);
    task.score = Number(raw);
    task.reviewComment = optionalText(input.comment, 'คอมเมนต์');
    task.reviewedAt = new Date();
    return this.tasks.save(task);
  }

  async clearReview(userId: number, id: number) {
    const task = await this.findOwn(userId, id);
    task.score = null;
    task.reviewComment = null;
    task.reviewedAt = null;
    return this.tasks.save(task);
  }

  async remove(userId: number, id: number) {
    const task = await this.findOwn(userId, id);
    await this.tasks.delete({ id: task.id, userId });
    return task;
  }

  /** หา task ของ user คนนี้เท่านั้น · ไม่เจอ = แจ้ง error (ไม่บอกว่าเป็นของคนอื่น) */
  private async findOwn(userId: number, id: number) {
    const task = Number.isInteger(id) && id > 0 ? await this.tasks.findOneBy({ id, userId }) : null;
    if (!task) throw new BadRequestException('ไม่พบ task');
    return task;
  }

  private parse(input: TaskInput) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new BadRequestException('กรุณากรอกชื่อ task');
    if (title.length > MAX_TITLE) throw new BadRequestException(`ชื่อ task ยาวเกิน ${MAX_TITLE} ตัวอักษร`);

    const dueDate = input.due ?? '';
    if (!isValidDate(dueDate)) throw new BadRequestException('กรุณาเลือกวันที่ต้องเสร็จ');

    const shift = SHIFTS.find((s) => s === input.shift);
    if (!shift) throw new BadRequestException('กรุณาเลือกกะ');
    if (shift === 'night' && dayOfWeek(dueDate) === FRIDAY) throw new BadRequestException('วันศุกร์ไม่มีกะกลางคืน');

    const priority = PRIORITIES.find((p) => p === input.priority);
    if (!priority) throw new BadRequestException('กรุณาเลือกความเร่งด่วน');

    return { title, detail: optionalText(input.detail, 'รายละเอียด'), dueDate, shift, priority };
  }
}
