import express, { Express, Router } from 'express';

import redirectController from '@controllers/RedirectController';
import { redirectRateLimiter } from '@middlewares/rateLimit';
import { sanitizeBody } from '@middlewares/sanitize';
import healthRouter from '@routes/healthRouter';
import urlRouter from '@routes/urlRouter';

const routes = (app: Express): void => {
  const apiRouter = Router();
  apiRouter.use(express.json());
  apiRouter.use(sanitizeBody);
  apiRouter.use('/health', healthRouter);
  apiRouter.use('/urls', urlRouter);

  app.use('/api/v1', apiRouter);
  app.get('/:code', redirectRateLimiter, (req, res, next) =>
    redirectController.handle(req, res, next),
  );
};

export default routes;
