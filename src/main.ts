import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setBaseViewsDir(join(process.cwd(), 'view'));
  app.useStaticAssets(join(process.cwd(), 'public'));
  app.setViewEngine('ejs');
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
