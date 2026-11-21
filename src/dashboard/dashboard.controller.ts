import { Controller, Get, Query, Redirect, Render, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service.js';

// toast หลังติ๊ก task จากกล่อง Task วันนี้ (?saved=...)
const SAVED_MSG: Record<string, string> = {
  done: 'ทำเครื่องหมายเสร็จแล้ว',
  undone: 'ยกเลิกเครื่องหมายเสร็จแล้ว',
};

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // เข้าเว็บที่ "/" → ไปหน้า dashboard
  @Get()
  @Redirect('/dashboard')
  root() {}

  @Get('dashboard')
  @Render('dashboard/index')
  async index(@Req() req: Request, @Query('saved') saved?: string, @Query('error') error?: string) {
    return {
      ...(await this.dashboardService.getPageData(req.session.userId!)),
      status: saved ? SAVED_MSG[saved] : undefined,
      error: error ? String(error).slice(0, 200) : undefined,
    };
  }
}
