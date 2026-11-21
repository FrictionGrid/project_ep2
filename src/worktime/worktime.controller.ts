import { BadRequestException, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type SaveLeaveInput,
  type SaveShiftInput,
  SHIFT_LABEL,
  WorktimeService,
  dateLabel,
  isValidDate,
  weekStartOf,
} from './worktime.service.js';

@Controller('worktime')
export class WorktimeController {
  constructor(private readonly worktime: WorktimeService) {}

  // GET /worktime?week=YYYY-MM-DD (วันไหนก็ได้ในสัปดาห์นั้น · ไม่ใส่ = สัปดาห์นี้)
  @Get()
  async index(
    @Req() req: Request,
    @Res() res: Response,
    @Query('week') week?: string,
    @Query('saved') saved?: string,
    @Query('shift') shift?: string,
    @Query('error') error?: string,
  ) {
    const data = await this.worktime.getWeek(req.session.userId!, week);
    const savedOk = saved && data.days.some((d) => d.date === saved);
    const shiftLabel = shift === 'day' || shift === 'night' ? ` (${SHIFT_LABEL[shift]})` : '';

    res.render('worktime/index', {
      pageTitle: 'Timesheet',
      ...data,
      // ‹ ช่วงวันที่ › บน topbar (partials/topbar.ejs)
      periodNav: {
        label: data.rangeLabel,
        prevHref: `/worktime?week=${data.prevWeek}`,
        nextHref: `/worktime?week=${data.nextWeek}`,
      },
      status: savedOk ? `บันทึกวัน${dateLabel(saved)}${shiftLabel} แล้ว` : undefined,
      error: error ? String(error).slice(0, 200) : undefined,
    });
  }

  // POST /worktime → ลงเวลา 1 กะ (action: work | partial | leave | clear)
  @Post()
  async saveShift(@Req() req: Request, @Res() res: Response, @Body() body: SaveShiftInput) {
    await this.handle(res, body.date, async () => {
      const r = await this.worktime.saveShift(req.session.userId!, body);
      return `saved=${r.date}&shift=${r.shift}`;
    });
  }

  // POST /worktime/leave → ลางาน (กะเดียวหรือทั้งวัน · ทั้งกะหรือบางชั่วโมง)
  @Post('leave')
  async saveLeave(@Req() req: Request, @Res() res: Response, @Body() body: SaveLeaveInput) {
    await this.handle(res, body.date, async () => {
      const r = await this.worktime.saveLeave(req.session.userId!, body);
      return `saved=${r.date}${r.shift ? `&shift=${r.shift}` : ''}`;
    });
  }

  /** บันทึกแล้วเด้งกลับสัปดาห์เดิม (กัน refresh แล้วส่งซ้ำ) · error ส่งกลับไปแสดงด้านบน */
  private async handle(res: Response, rawDate: string | undefined, run: () => Promise<string>) {
    const date = rawDate && isValidDate(rawDate) ? rawDate : undefined;
    const week = date ? `week=${weekStartOf(date)}&` : '';
    try {
      res.redirect(`/worktime?${week}${await run()}`);
    } catch (e) {
      if (!(e instanceof BadRequestException)) throw e;
      res.redirect(`/worktime?${week}error=${encodeURIComponent(e.message)}`);
    }
  }
}
