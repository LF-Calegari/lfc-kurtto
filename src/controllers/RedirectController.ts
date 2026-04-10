import { NextFunction, Request, Response } from 'express';

import urlService from '@services/UrlService';

const CACHE_CONTROL = 'no-cache, no-store, must-revalidate';

function routeParam(value: string | string[] | undefined): string {
  if (value === undefined) {
    return '';
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

class RedirectController {
  public async handle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const code = routeParam(req.params.code);
      if (!code) {
        res.status(404).json({ message: 'URL not found' });
        return;
      }

      const result = await urlService.resolveRedirect(code);

      if (result.outcome === 'not_found') {
        res.status(404).json({ message: 'URL not found' });
        return;
      }
      if (result.outcome === 'gone_inactive') {
        res.status(410).json({
          message: 'This short link is inactive.',
        });
        return;
      }
      if (result.outcome === 'gone_expired') {
        res.status(410).json({
          message: 'This short link has expired.',
        });
        return;
      }

      console.info('[redirect] 302', { shortCode: code });
      res.setHeader('Cache-Control', CACHE_CONTROL);
      res.redirect(302, result.originalUrl);
      urlService.scheduleClickIncrement(code);
    } catch (error) {
      next(error);
    }
  }
}

export default new RedirectController();
