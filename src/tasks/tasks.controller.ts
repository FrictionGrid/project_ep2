import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Task } from '../entities/task.entity.js';
import { isValidDate, weekStartOf } from '../worktime/worktime.service.js';
import { type ReviewInput, type TaskInput, TasksService } from './tasks.service.js';

// ข้อความ toast หลังบันทึก (?saved=...)
const SAVED_MSG: Record<string, string> = {
  created: 'เพิ่ม task แล้ว',
  updated: 'บันทึกการแก้ไขแล้ว',
  done: 'ทำเครื่องหมายเสร็จแล้ว',
  undone: 'ยกเลิกเครื่องหมายเสร็จแล้ว',
  reviewed: 'บันทึกคะแนนแล้ว',
  cleared: 'ล้างคะแนนแล้ว',
  deleted: 'ลบ task แล้ว',
};

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  // GET /tasks?week=YYYY-MM-DD (วันไหนก็ได้ในสัปดาห์นั้น · ไม่ใส่ = สัปดาห์นี้)
  @Get()
  async index(
    @Req() req: Request,
    @Res() res: Response,
    @Query('week') week?: string,
    @Query('saved') saved?: string,
    @Query('error') error?: string,
  ) {
    const data = await this.tasks.getWeek(req.session.userId!, week);
    res.render('tasks/index', {
      pageTitle: 'Tasks',
      ...data,
      periodNav: {
        label: data.rangeLabel,
        prevHref: `/tasks?week=${data.prevWeek}`,
        nextHref: `/tasks?week=${data.nextWeek}`,
      },
      status: saved ? SAVED_MSG[saved] : undefined,
      error: error ? String(error).slice(0, 200) : undefined,
    });
  }

  // POST /tasks → เพิ่ม task
  @Post()
  async create(@Req() req: Request, @Res() res: Response, @Body() body: TaskInput & { week?: string }) {
    await this.handle(res, body.week, async () => ({
      task: await this.tasks.create(req.session.userId!, body),
      saved: 'created',
    }));
  }

  // POST /tasks/:id/edit → แก้ชื่อ รายละเอียด วันที่ กะ ความเร่งด่วน
  @Post(':id/edit')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: TaskInput & { week?: string },
  ) {
    await this.handle(res, body.week, async () => ({
      task: await this.tasks.update(req.session.userId!, Number(id), body),
      saved: 'updated',
    }));
  }

  // POST /tasks/:id/toggle → สลับ เสร็จ / ยังไม่เสร็จ
  // from=dashboard → ติ๊กจากกล่อง Task วันนี้ แล้วเด้งกลับ Dashboard
  @Post(':id/toggle')
  async toggle(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body('week') week?: string,
    @Body('from') from?: string,
  ) {
    const run = async () => {
      const task = await this.tasks.toggle(req.session.userId!, Number(id));
      return { task, saved: task.isDone ? 'done' : 'undone' };
    };
    if (from !== 'dashboard') return this.handle(res, week, run);
    try {
      const { saved } = await run();
      res.redirect(`/dashboard?saved=${saved}`);
    } catch (e) {
      if (!(e instanceof BadRequestException)) throw e;
      res.redirect(`/dashboard?error=${encodeURIComponent(e.message)}`);
    }
  }

  // POST /tasks/:id/review → ให้คะแนน 0–10 + คอมเมนต์
  @Post(':id/review')
  async review(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: ReviewInput & { week?: string },
  ) {
    await this.handle(res, body.week, async () => ({
      task: await this.tasks.review(req.session.userId!, Number(id), body),
      saved: 'reviewed',
    }));
  }

  // POST /tasks/:id/review/clear → ล้างคะแนน
  @Post(':id/review/clear')
  async clearReview(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Body('week') week?: string) {
    await this.handle(res, week, async () => ({
      task: await this.tasks.clearReview(req.session.userId!, Number(id)),
      saved: 'cleared',
    }));
  }

  // POST /tasks/:id/delete → ลบ task
  @Post(':id/delete')
  async remove(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Body('week') week?: string) {
    await this.handle(res, week, async () => ({
      task: await this.tasks.remove(req.session.userId!, Number(id)),
      saved: 'deleted',
    }));
  }

  /**
   * บันทึกแล้วเด้งกลับ (กัน refresh แล้วส่งซ้ำ) ไปสัปดาห์ของ task นั้น
   * error → กลับสัปดาห์ที่ดูอยู่ (week จากฟอร์ม) พร้อมข้อความ
   */
  private async handle(res: Response, rawWeek: string | undefined, run: () => Promise<{ task: Task; saved: string }>) {
    const back = rawWeek && isValidDate(rawWeek) ? `week=${weekStartOf(rawWeek)}&` : '';
    try {
      const { task, saved } = await run();
      res.redirect(`/tasks?week=${weekStartOf(task.dueDate)}&saved=${saved}`);
    } catch (e) {
      if (!(e instanceof BadRequestException)) throw e;
      res.redirect(`/tasks?${back}error=${encodeURIComponent(e.message)}`);
    }
  }
}
