import { AppError } from './AppError.js';

export class ConflictError extends AppError {
  constructor(message = 'custom_code already exists') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}
