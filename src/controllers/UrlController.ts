import { Request, Response } from 'express';

import { AppError } from '@errors/AppError';
import { NotFoundError } from '@errors/NotFoundError';
import { ValidationError } from '@errors/ValidationError';
import { HttpStatusCode } from '@utils/HttpStatusCode';
import { requireAdminOperation } from '@utils/adminAuth';
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

class UrlController {
  public async create(req: Request, res: Response): Promise<void> {
    const url = await urlService.create(req.body);
    res.status(HttpStatusCode.CREATED).json(serializeUrl(url));
  }

  public async list(req: Request, res: Response): Promise<void> {
    const parsed = ListUrlsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(zodErrorResponse(parsed.error));
    }
    if (parsed.data.include_deleted === true) {
      requireAdminOperation(req);
    }
    const result = await urlService.list(parsed.data);
    res.status(HttpStatusCode.OK).json(result);
  }

  public async getByCode(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const q = GetUrlByCodeQuerySchema.safeParse(req.query);
    if (!q.success) {
      throw new ValidationError(zodErrorResponse(q.error));
    }
    if (q.data.include_deleted === true) {
      requireAdminOperation(req);
    }
    const url = await urlService.getByShortCode(code, {
      withDeleted: q.data.include_deleted === true,
    });
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.OK).json(serializeUrl(url));
  }

  public async patch(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const url = await urlService.patch(code, req.body);
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.OK).json(serializeUrl(url));
  }

  public async remove(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const removed = await urlService.remove(code);
    if (!removed) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.NO_CONTENT).send();
  }

  public async restore(req: Request, res: Response): Promise<void> {
    requireAdminOperation(req);
    const code = routeParam(req.params.code);
    const existing = await urlService.getByShortCode(code, {
      withDeleted: true,
    });
    if (!existing) {
      throw new NotFoundError('URL not found');
    }
    if (existing.deletedAt === null) {
      throw new AppError(
        'URL is not soft-deleted',
        HttpStatusCode.UNPROCESSABLE_ENTITY,
      );
    }
    await urlService.restore(code);
    const url = await urlService.getByShortCode(code);
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(HttpStatusCode.OK).json(serializeUrl(url));
  }
}

export default new UrlController();
