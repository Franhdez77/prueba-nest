import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const value = (body as { message?: unknown }).message;
        if (
          typeof value === 'string' ||
          (Array.isArray(value) &&
            value.every((item) => typeof item === 'string'))
        )
          message = value;
        else message = exception.message;
      }
    } else if (exception instanceof QueryFailedError) {
      // Traduce conflictos de PostgreSQL sin exponer consultas ni datos internos.
      const code = (exception.driverError as { code?: string }).code;
      if (code === '23505') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Ya existe un registro con esos datos únicos';
      } else if (code === '23503') {
        statusCode = HttpStatus.CONFLICT;
        message = 'La operación entra en conflicto con un registro relacionado';
      } else if (
        code === '23502' ||
        code === '23514' ||
        code === '22P02' ||
        code === '22003' ||
        code === '22007' ||
        code === '22008'
      ) {
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Los datos no cumplen las restricciones de la base de datos';
      } else if (code === '23P01') {
        statusCode = HttpStatus.CONFLICT;
        message = 'La operación entra en conflicto con un registro existente';
      }
    }
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        'Error no controlado',
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    response
      .status(statusCode)
      .json({
        success: false,
        statusCode,
        message,
        path: request.path,
        timestamp: new Date().toISOString(),
      });
  }
}
