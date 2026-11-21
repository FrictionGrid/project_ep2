import { Controller, Get, Render } from '@nestjs/common';

// ปฏิทินตารางเวลา (นัดหมาย / ประชุม / กิจกรรมทุกอย่าง)
// ตอนนี้หน้าบ้านอย่างเดียว: เพิ่ม/แก้ในเบราว์เซอร์ · รีเฟรชแล้วหาย (ยังไม่ต่อ DB)
@Controller('calendar')
export class CalendarController {
  @Get()
  @Render('calendar/index')
  index() {
    return { pageTitle: 'Calendar' };
  }
}
