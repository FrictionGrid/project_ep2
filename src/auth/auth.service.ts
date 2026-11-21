import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity.js';
import { UserService } from '../user/user.service.js';

// hash หลอก: ใช้ตอนไม่เจออีเมล ให้เวลาตอบเท่ากับกรณีรหัสผิด (กันเดาว่าอีเมลไหนมีในระบบ)
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  /** คืน user ถ้าอีเมล+รหัสถูกและบัญชียังเปิดใช้งาน ไม่งั้นคืน null */
  async validate(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) return null;
    return user;
  }

  findActiveById(id: number): Promise<User | null> {
    return this.userService.findActiveById(id);
  }
}
