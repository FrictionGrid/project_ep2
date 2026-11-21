import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setBaseViewsDir(join(process.cwd(), 'view'));
  app.useStaticAssets(join(process.cwd(), 'public'));
  app.setViewEngine('ejs');
  app.use(expressLayouts);
  app.set('layout', 'layouts/layout_ep1');

  // session เก็บใน Postgres (ตาราง "session" สร้างให้อัตโนมัติ) → รีสตาร์ทเซิร์ฟเวอร์แล้วยังไม่หลุด login
  if (!process.env.SESSION_SECRET) throw new Error('ตั้ง SESSION_SECRET ใน .env ก่อน');
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      name: 'sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: new PgStore({
        conObject: {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT) || 5432,
          user: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
        createTableIfMissing: true,
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8, // 8 ชั่วโมง
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
