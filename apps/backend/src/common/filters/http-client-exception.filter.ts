import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from "@repo/db";

interface ErrorResponse {
  statusCode: number;
  message: string;
  success: false;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let errorResponse: ErrorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unknown error occurred',
      success: false,
    };

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      errorResponse.statusCode = exception.getStatus();

      if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        const message = exceptionResponse.message;
        if (Array.isArray(message)) errorResponse.message = message[0];
        else if (typeof message === 'string') errorResponse.message = message;
      } else {
        errorResponse.message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = exception as Prisma.PrismaClientKnownRequestError;
      switch (prismaError.code) {
        case 'P2002':
          errorResponse.statusCode = HttpStatus.CONFLICT;
          errorResponse.message = 'Unique constraint failed on the fields: ' + prismaError.meta?.target;
          break;
        case 'P2025':
          errorResponse.statusCode = HttpStatus.NOT_FOUND;
          errorResponse.message = 'Record to update not found.';
          break;
        default:
          errorResponse.statusCode = HttpStatus.BAD_REQUEST;
          errorResponse.message = `Database error: ${prismaError.message}`;
      }
    } else if (exception instanceof Error) {
      errorResponse.message = exception.message;
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }
}