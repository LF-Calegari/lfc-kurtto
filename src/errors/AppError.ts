import { HttpStatusCode } from '@utils/HttpStatusCode';

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(
    message: string,
    statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
