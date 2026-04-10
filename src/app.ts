import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { buildCorsOptions } from './config/cors.js';
import errorHandler from '@middlewares/errorHandler';
import { globalRateLimiter } from '@middlewares/rateLimit';
import routes from '@routes/index';
import swagger from './swagger/index.js';

const app = express();

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(globalRateLimiter);

swagger(app);
routes(app);

app.use((_req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

app.use(errorHandler);

export default app;
