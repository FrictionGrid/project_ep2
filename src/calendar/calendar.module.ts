import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller.js';

// หน้าบ้านอย่างเดียว · ต่อ DB ภายหลังค่อยเพิ่ม service + entity
@Module({
  controllers: [CalendarController],
})
export class CalendarModule {}
