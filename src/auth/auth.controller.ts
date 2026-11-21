import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from './auth.guard.js';
import { AuthService } from './auth.service.js';

interface LoginBody {
  email?: string;
  password?: string;
}

const HOME = '/dashboard';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('login')
  loginPage(@Req() req: Request, @Res() res: Response) {
    if (req.session.userId) return res.redirect(HOME);
    // layout: false = หน้า login ไม่ใช้ layout หลัก (ไม่มี sidebar/topbar)
    res.render('auth/login', { layout: false });
  }

  @Post('login')
  async login(@Body() body: LoginBody, @Req() req: Request, @Res() res: Response) {
    const email = (body.email ?? '').trim();
    const password = body.password ?? '';

    const errors: Record<string, string> = {};
    if (!email) errors.email = 'กรุณากรอกอีเมล';
    if (!password) errors.password = 'กรุณากรอกรหัสผ่าน';

    const user = Object.keys(errors).length ? null : await this.auth.validate(email, password);
    if (!user) {
      return res.status(Object.keys(errors).length ? 400 : 401).render('auth/login', {
        layout: false,
        errors,
        error: Object.keys(errors).length ? undefined : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        old: { email },
      });
    }

    // ออก session id ใหม่ทุกครั้งที่ login (กัน session fixation)
    req.session.regenerate((err) => {
      if (err) return res.status(500).send('Session error');
      req.session.userId = user.id;
      req.session.save(() => res.redirect(HOME));
    });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => {
      res.clearCookie('sid');
      res.redirect('/auth/login');
    });
  }
}
