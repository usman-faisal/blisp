import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-client-exception.filter';
import { TEAM_ID_HEADER } from './common/lib/constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 8000;
  const CORS_ORIGINS = configService.get<string>('CORS_ORIGINS') || 'http://localhost:3000';

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Security response headers (nosniff, frameguard, HSTS, and similar).
  // contentSecurityPolicy is disabled because this process serves a JSON API to
  // a native client plus the Swagger UI, which loads its own inline assets; a
  // default CSP breaks that page without protecting an API that renders no HTML.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: CORS_ORIGINS.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', TEAM_ID_HEADER],
    // Named rather than '*', which with credentials:true is both over-broad and
    // ignored by browsers anyway. These are the headers the client reads:
    // Retry-After accompanies a 429 from the rate limiter.
    exposedHeaders: ['Retry-After'],
    maxAge: 3600,
  });

  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Vonc Backend API')
    .setDescription('Vonc Backend API Documentation')
    .setVersion('1.0')
    .addTag('Vonc Backend API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addSecurityRequirements('JWT-auth')
    .build();

  // Swagger is a development aid. Every documented route is guarded, so serving
  // it is not itself a vulnerability — but it publishes the full API surface and
  // the dev token helper's usage notes, which is free reconnaissance for no
  // benefit on a deployed instance.
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
  });
}
bootstrap();
