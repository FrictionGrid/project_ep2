import { Controller } from '@nestjs/common';
import { UserService } from './user.service.js';

// หน้าจัดการผู้ใช้ (ยังไม่มี route) · ต้อง login ก่อนเข้า (AuthGuard ทั้งแอป)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
}
