import express, { Express, Router } from 'express';

import redirectController from '@controllers/RedirectController';
import healthRouter from '@routes/healthRouter';
import urlRouter from '@routes/urlRouter';

const routes = (app: Express): void => {
  const apiRouter = Router();
  apiRouter.use(express.json());
  apiRouter.use('/health', healthRouter);
  apiRouter.use('/urls', urlRouter);

  app.use('/api/v1', apiRouter);
  app.get('/:code', (req, res, next) =>
    redirectController.handle(req, res, next),
  );
};

export default routes;
