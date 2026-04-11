import { Router } from 'express';

import urlController from '@controllers/UrlController';
import { postUrlsRateLimiter } from '@middlewares/rateLimit';
import { validateBody } from '@middlewares/validate';
import { CreateUrlSchema, PatchUrlSchema } from '../dtos/UrlDto.js';

const urlRouter = Router();

/**
 * @swagger
 * /urls:
 *   post:
 *     summary: Cria link encurtado
 *     tags: [Urls]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUrlRequest'
 *     responses:
 *       201:
 *         description: Recurso criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       409:
 *         description: custom_code ja em uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: custom_code already exists
 *       422:
 *         description: Payload invalido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
urlRouter.post(
  '/',
  postUrlsRateLimiter,
  validateBody(CreateUrlSchema),
  (req, res, next) => {
    void urlController.create(req, res).catch(next);
  },
);

/**
 * @swagger
 * /urls:
 *   get:
 *     summary: Lista URLs paginada
 *     tags: [Urls]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: active
 *         description: Filtra por ativo (string "true" ou "false")
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: Lista paginada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       422:
 *         description: Query invalida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
urlRouter.get('/', (req, res, next) => {
  void urlController.list(req, res).catch(next);
});

/**
 * @swagger
 * /urls/{code}:
 *   get:
 *     summary: Obtem URL por codigo curto
 *     tags: [Urls]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       404:
 *         description: Nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
urlRouter.get('/:code', (req, res, next) => {
  void urlController.getByCode(req, res).catch(next);
});

/**
 * @swagger
 * /urls/{code}:
 *   patch:
 *     summary: Atualiza URL parcialmente
 *     tags: [Urls]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUrlRequest'
 *     responses:
 *       200:
 *         description: Atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       404:
 *         description: Nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Body invalido ou nenhum campo enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
urlRouter.patch(
  '/:code',
  validateBody(PatchUrlSchema),
  (req, res, next) => {
    void urlController.patch(req, res).catch(next);
  },
);

/**
 * @swagger
 * /urls/{code}:
 *   delete:
 *     summary: Remove URL permanentemente
 *     tags: [Urls]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removido (sem corpo)
 *       404:
 *         description: Nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
urlRouter.delete('/:code', (req, res, next) => {
  void urlController.remove(req, res).catch(next);
});

export default urlRouter;
