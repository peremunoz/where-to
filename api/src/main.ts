import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix: all routes will be /api/...
  app.setGlobalPrefix('api');

  // Enable CORS for frontend development
  app.enableCors();

  // Global validation pipe — transforms payloads to DTO instances and strips unknown properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Where-To API running on http://localhost:${port}/api`);
}
void bootstrap();
