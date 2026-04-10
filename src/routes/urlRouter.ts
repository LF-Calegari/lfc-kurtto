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
  (req, res, next) => {
    void urlController.create(req, res).catch(next);
  },
);

urlRouter.get('/', (req, res, next) => {
  void urlController.list(req, res).catch(next);
});

urlRouter.get('/:code', (req, res, next) => {
  void urlController.getByCode(req, res).catch(next);
});

urlRouter.patch(
  '/:code',
  validateBody(PatchUrlSchema),
  (req, res, next) => {
    void urlController.patch(req, res).catch(next);
  },
);

urlRouter.delete('/:code', (req, res, next) => {
  void urlController.remove(req, res).catch(next);
});

export default urlRouter;
