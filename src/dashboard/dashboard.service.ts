import { Injectable } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service.js';
import { WorktimeService } from '../worktime/worktime.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly worktime: WorktimeService,
    private readonly tasks: TasksService,
  ) {}

  /** ข้อมูลหน้า Dashboard: เวลาทำงานสัปดาห์นี้ + กะวันนี้ + task วันนี้/ค้าง + สรุป task สัปดาห์นี้ */
  async getPageData(userId: number) {
    const [week, tasks] = await Promise.all([this.worktime.getWeek(userId), this.tasks.getDashboard(userId)]);
    return {
      pageTitle: 'Dashboard',
      summary: week.summary,
      rangeLabel: week.rangeLabel,
      today: week.days.find((d) => d.isToday) ?? null,
      days: week.days,
      todayTasks: tasks.todayTasks,
      weekTasks: tasks.weekTasks,
    };
  }
}
