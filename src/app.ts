import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { buildCorsOptions } from './config/cors.js';
import { NotFoundError } from '@errors/NotFoundError';
import errorHandler from '@middlewares/errorHandler';
import { globalRateLimiter } from '@middlewares/rateLimit';
import { requestLogger } from '@middlewares/requestLogger';
import routes from '@routes/index';
import { setupSwagger } from './config/swagger.js';

const app = express();

app.use(helmet());
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);
app.use(cors(buildCorsOptions()));
app.use(globalRateLimiter);
app.use(requestLogger);

setupSwagger(app);
routes(app);

app.use((_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});

app.use(errorHandler);

export default app;
