import { Request, Response } from 'express';

import { NotFoundError } from '@errors/NotFoundError';
import { ValidationError } from '@errors/ValidationError';
import { ListUrlsQuerySchema } from '../dtos/UrlDto.js';
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
    res.status(201).json(serializeUrl(url));
  }

  public async list(req: Request, res: Response): Promise<void> {
    const parsed = ListUrlsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(zodErrorResponse(parsed.error));
    }
    const result = await urlService.list(parsed.data);
    res.status(200).json(result);
  }

  public async getByCode(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const url = await urlService.getByShortCode(code);
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(200).json(serializeUrl(url));
  }

  public async patch(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const url = await urlService.patch(code, req.body);
    if (!url) {
      throw new NotFoundError('URL not found');
    }
    res.status(200).json(serializeUrl(url));
  }

  public async remove(req: Request, res: Response): Promise<void> {
    const code = routeParam(req.params.code);
    const removed = await urlService.remove(code);
    if (!removed) {
      throw new NotFoundError('URL not found');
    }
    res.status(204).send();
  }
}

export default new UrlController();
