import { Request, Response } from 'express';

import { logger } from '@config/logger';
import { AppError } from '@errors/AppError';
import { NotFoundError } from '@errors/NotFoundError';
import urlService from '@services/UrlService';
import { HttpStatusCode } from '@utils/HttpStatusCode';

const CACHE_CONTROL = 'no-cache, no-store, must-revalidate';

function routeParam(value: string | string[] | undefined): string {
  if (value === undefined) {
    return '';
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

class RedirectController {
  public async handle(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    if (!code) {
      throw new NotFoundError('URL not found');
    }

    const result = await urlService.resolveRedirect(code);

    if (result.outcome === 'not_found') {
      throw new NotFoundError('URL not found');
    }
    if (result.outcome === 'gone_inactive') {
      throw new AppError(
        'This short link is inactive.',
        HttpStatusCode.GONE,
      );
    }
    if (result.outcome === 'gone_expired') {
      throw new AppError(
        'This short link has expired.',
        HttpStatusCode.GONE,
      );
    }

    logger.info(`${req.method} /${code} redirect`, {
      context: 'redirect',
      shortCode: code,
    });
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.redirect(HttpStatusCode.FOUND, result.originalUrl);
    urlService.scheduleClickIncrement(code);
  }
}

export default new RedirectController();
