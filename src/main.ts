import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import expressLayouts from "express-ejs-layouts";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setBaseViewsDir(join(process.cwd(), 'view'));
  app.useStaticAssets(join(process.cwd(), 'public'));
  app.setViewEngine('ejs');
  app.use(expressLayouts);
  app.set('layout', 'layouts/layout_ep1');
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
