import { HttpStatusCode } from '@utils/HttpStatusCode';

import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, HttpStatusCode.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}
