import { HttpStatusCode } from '@utils/HttpStatusCode';

import { AppError } from './AppError.js';

export class ConflictError extends AppError {
  constructor(message = 'custom_code already exists') {
    super(message, HttpStatusCode.CONFLICT);
    this.name = 'ConflictError';
  }
}
