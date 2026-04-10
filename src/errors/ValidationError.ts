import { AppError } from './AppError.js';

export type ValidationErrorBody = {
  error: string;
  details: { field: string; message: string }[];
};

export class ValidationError extends AppError {
  readonly body: ValidationErrorBody;

  constructor(body: ValidationErrorBody) {
    super(body.error, 422);
    this.name = 'ValidationError';
    this.body = body;
  }
}
