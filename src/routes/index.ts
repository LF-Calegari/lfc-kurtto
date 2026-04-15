import express, { Express, Router } from 'express';

import redirectController from '@controllers/RedirectController';
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
  /**
   * @swagger
   * /{code}:
   *   get:
   *     summary: Redireciona para a URL original
   *     description: Rota publica na raiz do host (nao usa prefixo /api/v1).
   *     tags: [Redirect]
   *     servers:
   *       - url: /
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       302:
   *         description: Redirecionamento para original_url (Location)
   *       404:
   *         description: Codigo inexistente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       410:
   *         description: Link inativo ou expirado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get('/:code', (req, res, next) => {
    void redirectController.handle(req, res).catch(next);
  });
};

export default routes;
