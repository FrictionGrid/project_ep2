import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';

// หน้าบ้านอย่างเดียว · ต่อ AI / เก็บประวัติแชทภายหลังค่อยเพิ่ม service
@Module({
  controllers: [ChatController],
})
export class ChatModule {}
