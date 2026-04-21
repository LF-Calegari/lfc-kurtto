import type { AuthVerificationResult } from
  '../services/AuthVerificationService.js';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo `authorizeRoute` após `verifyToken` bem-sucedido. */
      user?: AuthVerificationResult;
    }
  }
}

export {};
