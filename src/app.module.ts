import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { ChatModule } from './chat/chat.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { UserModule } from './user/user.module.js';
import { WorktimeModule } from './worktime/worktime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
    }),
    AuthModule,
    UserModule,
    DashboardModule,
    WorktimeModule,
    TasksModule,
    CalendarModule,
    ChatModule,
  ],
})
export class AppModule {}
