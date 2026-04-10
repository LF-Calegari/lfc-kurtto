import express, { Express } from 'express';

import healthRouter from '@routes/healthRouter';
import urlRouter from '@routes/urlRouter';

const routes = (app: Express): void => {
  app.use(express.json());
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/urls', urlRouter);
};

export default routes;
