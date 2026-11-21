import { Controller, Get, Render } from '@nestjs/common';

// หน้าแชทบอท · ตอนนี้หน้าบ้านอย่างเดียว: คำตอบ hardcode ใน view (ยังไม่ต่อ AI / DB)
@Controller('chat')
export class ChatController {
  @Get()
  @Render('chat/index')
  index() {
    return { pageTitle: 'Chatbot' };
  }
}
