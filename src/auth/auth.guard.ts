import {
  ArgumentsHost,
  Catch,
  CanActivate,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

// ใส่ @Public() ให้หน้าที่ไม่ต้อง login (เช่นหน้า login เอง)
const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export class LoginRequiredException extends HttpException {
  constructor() {
    super('Login required', HttpStatus.UNAUTHORIZED);
  }
}

/** Guard ทั้งแอป: ยังไม่ login → เด้งไปหน้า login · login แล้ว → ส่ง user ให้ layout (topbar) */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const userId = req.session.userId;
    const user = userId ? await this.auth.findActiveById(userId) : null;

    if (!user) {
      // บัญชีถูกปิด/ลบระหว่างที่ login อยู่ → ล้าง session ทิ้ง
      if (userId) await new Promise<void>((r) => req.session.destroy(() => r()));
      throw new LoginRequiredException();
    }

    res.locals.user = { id: user.id, name: user.email.split('@')[0], email: user.email };
    res.locals.currentPath = req.path;
    return true;
  }
}

@Catch(LoginRequiredException)
export class LoginRedirectFilter implements ExceptionFilter {
  catch(_e: LoginRequiredException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().redirect('/auth/login');
  }
}
