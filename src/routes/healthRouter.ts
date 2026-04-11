import { Router } from 'express';

import healthController from '@controllers/HealthController';

const healthRouter = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verifica a saude da API
 *     description: Indica se a API responde, se o banco esta acessivel e o status opcional do Redis (cache de redirect); Redis indisponivel nao degrada o health quando apenas o banco esta ok.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API em funcionamento normal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - message
 *                 - timestamp
 *                 - uptime
 *                 - environment
 *                 - database
 *                 - cache
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: API is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Segundos desde o start do processo
 *                 environment:
 *                   type: string
 *                   enum: [development, test, production]
 *                 database:
 *                   type: string
 *                   enum: [connected, disconnected]
 *                 cache:
 *                   type: string
 *                   enum: [connected, disconnected]
 *                   description: Redis para cache de redirect; disconnected se REDIS_URL ausente ou indisponivel
 *       503:
 *         description: API degradada (banco indisponivel)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: degraded
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 environment:
 *                   type: string
 *                 database:
 *                   type: string
 *                   example: disconnected
 *                 cache:
 *                   type: string
 *                   enum: [connected, disconnected]
 */
healthRouter.get('/', (req, res, next) => {
  void healthController.check(req, res, next).catch(next);
});

export default healthRouter;
