import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// catch common Prisma errors and send clean HTTP JSON instead of raw 500s
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const mapped = mapPrismaError(exception);
    const status = mapped.getStatus();
    const body = mapped.getResponse();

    response
      .status(status)
      .json(
        typeof body === 'string'
          ? { statusCode: status, message: body, error: HttpStatus[status] }
          : body,
      );
  }
}

// convert Prisma errors into a Nest HTTP exception
function mapPrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
): HttpException {
  switch (exception.code) {
    case 'P2002': {
      // unique constraint failed
      const target = formatTarget(exception.meta?.target);
      return new ConflictException(
        target
          ? `A record with this ${target} already exists`
          : 'Unique constraint failed',
      );
    }
    case 'P2025':
      return new NotFoundException('Record not found');
    case 'P2003':
      return new ConflictException(
        'Related record not found or still referenced',
      );
    default:
      return new HttpException(
        'Database request failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
  }
}

// format the target of the Prisma error to a human-readable string
function formatTarget(target: unknown): string | null {
  if (Array.isArray(target) && target.length > 0) {
    return target.map(String).join(', ');
  }
  if (typeof target === 'string' && target.length > 0) {
    return target;
  }
  return null;
}
