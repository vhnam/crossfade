import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { Prisma } from '../../prisma/client';

interface ErrorResponse {
  statusCode: number;
  message: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { statusCode, message } = this.resolve(exception);

    this.logger.error(exception instanceof Error ? exception.stack : exception);

    response.status(statusCode).json({ statusCode, message } satisfies ErrorResponse);
  }

  private resolve(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message);
      return { statusCode: status, message: Array.isArray(message) ? message.join(', ') : message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      return { statusCode: HttpStatus.CONFLICT, message: 'Resource already exists' };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
