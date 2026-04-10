import { Router } from 'express';

import urlController from '@controllers/UrlController';
import { postUrlsRateLimiter } from '@middlewares/rateLimit';
import { validateBody } from '@middlewares/validate';
import { CreateUrlSchema, PatchUrlSchema } from '../dtos/UrlDto.js';

const urlRouter = Router();

urlRouter.post(
  '/',
  postUrlsRateLimiter,
  validateBody(CreateUrlSchema),
  (req, res, next) => urlController.create(req, res, next),
);

urlRouter.get('/', (req, res, next) => urlController.list(req, res, next));

urlRouter.get('/:code', (req, res, next) =>
  urlController.getByCode(req, res, next),
);

urlRouter.patch(
  '/:code',
  validateBody(PatchUrlSchema),
  (req, res, next) => urlController.patch(req, res, next),
);

urlRouter.delete('/:code', (req, res, next) =>
  urlController.remove(req, res, next),
);

export default urlRouter;
