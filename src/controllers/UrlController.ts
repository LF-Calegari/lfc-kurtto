import { Request, Response } from 'express';

import { AppError } from '@errors/AppError';
import { NotFoundError } from '@errors/NotFoundError';
import { ValidationError } from '@errors/ValidationError';
import type { UrlAccessActor } from '@services/UrlService';
import { HttpStatusCode } from '@utils/HttpStatusCode';
import { isKurttoAdmin } from '@utils/kurttoAdmin';
import {
  GetUrlByCodeQuerySchema,
  ListUrlsQuerySchema,
} from '../dtos/UrlDto.js';
import { zodErrorResponse } from '../middlewares/validate.js';
import urlService, { serializeUrl } from '../services/UrlService.js';

function routeParam(value: string | string[] | undefined): string {
  if (value === undefined) {
    return '';
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function urlActor(req: Request): UrlAccessActor {
  const user = req.user;
  if (!user) {
    throw new AppError(
      'Unauthorized: Bearer token is required.',
      HttpStatusCode.UNAUTHORIZED,
    );
  }
  return { userId: user.id, isAdmin: isKurttoAdmin(user) };
}

class UrlController {
  public async create(req: Request, res: Response): Promise<void> {
    const actor = urlActor(req);
    const url = await urlService.create(req.body, actor.userId);
    res.status(HttpStatusCode.CREATED).json(serializeUrl(url));
  }

  public async list(req: Request, res: Response): Promise<void> {
    const parsed = ListUrlsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(zodErrorResponse(parsed.error));
    }
    const result = await urlService.list(parsed.data, urlActor(req));
    res.status(HttpStatusCode.OK).json(result);
  }

  public async getByCode(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const q = GetUrlByCodeQuerySchema.safeParse(req.query);
    if (!q.success) {
      throw new ValidationError(zodErrorResponse(q.error));
    }
    const url = await urlService.getByShortCode(code, urlActor(req), {
      withDeleted: q.data.include_deleted === true,
    });
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.OK).json(serializeUrl(url));
  }

  public async patch(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const url = await urlService.patch(code, req.body, urlActor(req));
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.OK).json(serializeUrl(url));
  }

  public async remove(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const removed = await urlService.remove(code, urlActor(req));
    if (!removed) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.NO_CONTENT).send();
  }

  public async restore(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const actor = urlActor(req);
    const restored = await urlService.restore(code, actor);
    if (!restored) {
      const active = await urlService.getByShortCode(code, actor);
      if (active) {
        throw new AppError(
          'URL is not soft-deleted',
          HttpStatusCode.UNPROCESSABLE_ENTITY,
        );
      }
      throw new NotFoundError('URL not found');
    }
    const url = await urlService.getByShortCode(code, actor);
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.OK).json(serializeUrl(url));
  }
}

export default new UrlController();
