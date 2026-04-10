import { Router } from 'express';

import healthController from '@controllers/HealthController';

const healthRouter = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Verifica a saude da API
 *     description: Endpoint para verificar se a API esta funcionando corretamente
 *     tags: [Monitoramento]
 *     responses:
 *       200:
 *         description: API em funcionamento normal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: API is running
 *                 database:
 *                   type: string
 *                   enum: [connected, disconnected]
 *                   example: connected
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
 *                 database:
 *                   type: string
 *                   example: disconnected
 */
healthRouter.get('/', (req, res, next) => {
  void healthController.check(req, res, next).catch(next);
});

export default healthRouter;
