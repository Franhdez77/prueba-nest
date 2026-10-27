import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { ResponseInterceptor } from './interceptors/response.interceptor.js';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
export function configureApp(app: INestApplication) {
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
