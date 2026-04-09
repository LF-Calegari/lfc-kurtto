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
 */
healthRouter.get(
  '/',
  (req, res, next) => healthController.check(req, res, next),
);

export default healthRouter;
