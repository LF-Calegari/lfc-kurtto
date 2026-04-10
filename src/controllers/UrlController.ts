import { NextFunction, Request, Response } from 'express';

import { ListUrlsQuerySchema } from '../dtos/UrlDto.js';
import { zodErrorResponse } from '../middlewares/validate.js';
import urlService, { serializeUrl } from '../services/UrlService.js';

function routeParam(value: string | string[] | undefined): string {
  if (value === undefined) {
    return '';
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function getStatusCode(error: unknown): number | undefined {
  if (error instanceof Error && 'statusCode' in error) {
    const code = (error as Error & { statusCode?: number }).statusCode;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
}

class UrlController {
  public async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const url = await urlService.create(req.body);
      res.status(201).json(serializeUrl(url));
    } catch (error) {
      const status = getStatusCode(error);
      if (status === 409) {
        res.status(409).json({ message: 'custom_code already exists' });
        return;
      }
      if (status === 500 && error instanceof Error) {
        res.status(500).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  public async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = ListUrlsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json(zodErrorResponse(parsed.error));
        return;
      }
      const result = await urlService.list(parsed.data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getByCode(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const code = routeParam(req.params.code);
      const url = await urlService.getByShortCode(code);
      if (!url) {
        res.status(404).json({ message: 'URL not found' });
        return;
      }
      res.status(200).json(serializeUrl(url));
    } catch (error) {
      next(error);
    }
  }

  public async patch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const code = routeParam(req.params.code);
      const url = await urlService.patch(code, req.body);
      if (!url) {
        res.status(404).json({ message: 'URL not found' });
        return;
      }
      res.status(200).json(serializeUrl(url));
    } catch (error) {
      next(error);
    }
  }

  public async remove(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const code = routeParam(req.params.code);
      const removed = await urlService.remove(code);
      if (!removed) {
        res.status(404).json({ message: 'URL not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default new UrlController();
