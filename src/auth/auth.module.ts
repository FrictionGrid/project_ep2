import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { UserModule } from '../user/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard, LoginRedirectFilter } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard }, // ทุก route ต้อง login ยกเว้นที่ติด @Public()
    { provide: APP_FILTER, useClass: LoginRedirectFilter },
  ],
})
export class AuthModule {}
