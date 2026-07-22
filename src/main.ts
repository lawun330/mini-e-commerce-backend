import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // public demo / separate frontends
  app.enableCors();

  // set global prefix for all routes
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // use global filters for all requests
  app.useGlobalFilters(new PrismaExceptionFilter());

  // use global pipes for all requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: true, // rejects requests that include them
      transform: true, // transforms payloads into their DTO classes
    }),
  );

  // configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Mini E-Commerce Backend API')
    .setDescription('Backend API for products, cart, orders, and reviews')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  console.log(`Health check at http://localhost:${port}/health`);
}
void bootstrap();
