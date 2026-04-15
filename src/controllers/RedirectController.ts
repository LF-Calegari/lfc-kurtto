import { Request, Response } from 'express';

import { logger } from '@config/logger';
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
      res.status(HttpStatusCode.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Short link not found',
      });
      return;
    }

    const result = await urlService.resolveRedirect(code);

    if (result.outcome === 'not_found') {
      res.status(HttpStatusCode.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Short link not found',
      });
      return;
    }
    if (result.outcome === 'gone_inactive') {
      res.status(HttpStatusCode.GONE).json({
        error: 'Gone',
        message: 'This link has been deactivated',
      });
      return;
    }
    if (result.outcome === 'gone_expired') {
      res.status(HttpStatusCode.GONE).json({
        error: 'Gone',
        message: 'This link has expired',
      });
      return;
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
