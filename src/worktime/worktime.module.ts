import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkLog } from '../entities/work-log.entity.js';
import { WorktimeController } from './worktime.controller.js';
import { WorktimeService } from './worktime.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkLog])],
  controllers: [WorktimeController],
  providers: [WorktimeService],
  exports: [WorktimeService], // ให้ Dashboard ใช้สรุปสัปดาห์
})
export class WorktimeModule {}
