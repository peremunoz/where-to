import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';

const BASE_INSTITUTION_ID = '00000000-0000-0000-0000-000000000000';
const BASE_INSTITUTION_NAME = 'Aarhus University';
const BASE_INSTITUTION_ADDRESS = 'Nordre Ringgade 1, 8000 Aarhus C, Denmark';

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function colorMethod(method: string): string {
  switch (method) {
    case 'GET':
      return `${ansi.cyan}${method}${ansi.reset}`;
    case 'POST':
      return `${ansi.green}${method}${ansi.reset}`;
    case 'PATCH':
    case 'PUT':
      return `${ansi.yellow}${method}${ansi.reset}`;
    case 'DELETE':
      return `${ansi.red}${method}${ansi.reset}`;
    default:
      return `${ansi.magenta}${method}${ansi.reset}`;
  }
}

function colorStatus(statusCode: number): string {
  if (statusCode >= 500) {
    return `${ansi.red}${statusCode}${ansi.reset}`;
  }
  if (statusCode >= 400) {
    return `${ansi.yellow}${statusCode}${ansi.reset}`;
  }
  if (statusCode >= 300) {
    return `${ansi.cyan}${statusCode}${ansi.reset}`;
  }
  return `${ansi.green}${statusCode}${ansi.reset}`;
}

function formatBody(body: unknown): string {
  if (body === undefined || body === null) {
    return '{}';
  }

  if (typeof body === 'object' && Object.keys(body).length === 0) {
    return '{}';
  }

  try {
    const serialized = JSON.stringify(body);
    if (!serialized) {
      return '{}';
    }

    const maxLength = 1200;
    if (serialized.length > maxLength) {
      return `${serialized.slice(0, maxLength)}... [truncated]`;
    }

    return serialized;
  } catch {
    return '[unserializable body]';
  }
}

async function seedBaseInstitution(
  app: Awaited<ReturnType<typeof NestFactory.create>>,
) {
  const dataSource = app.get(DataSource);

  await dataSource.query(
    `
      INSERT INTO institutions (id, name, address, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        "updatedAt" = NOW()
    `,
    [BASE_INSTITUTION_ID, BASE_INSTITUTION_NAME, BASE_INSTITUTION_ADDRESS],
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend development
  app.enableCors();

  // Local request logger for hackathon development.
  if (process.env.NODE_ENV !== 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startedAt = Date.now();

      res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        const timestamp = new Date().toISOString();
        const bodyText = formatBody(req.body);
        console.log(
          `${ansi.dim}[HTTP] ${timestamp}${ansi.reset} ${colorMethod(req.method)} ${req.originalUrl} ${colorStatus(res.statusCode)} ${durationMs}ms body=${bodyText}`,
        );
      });

      next();
    });
  }

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

  await seedBaseInstitution(app);
  console.log(
    `${ansi.dim}[Seed] Ensured base institution: ${BASE_INSTITUTION_NAME} (${BASE_INSTITUTION_ID})${ansi.reset}`,
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Where-To API running on http://localhost:${port}`);
}
void bootstrap();
