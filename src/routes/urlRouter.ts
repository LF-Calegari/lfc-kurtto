import { Router } from 'express';

import urlController from '@controllers/UrlController';
import { postUrlsRateLimiter } from '@middlewares/rateLimit';
import { authorizeRoute } from '@middlewares/routeAuthorization';
import { validateBody } from '@middlewares/validate';
import { CreateUrlSchema, PatchUrlSchema } from '../dtos/UrlDto.js';

const urlRouter = Router();
const URL_ROUTE_CODES = {
  CREATE: 'KURTTO_V1_URLS_POST_CREATE',
  RESTORE: 'KURTTO_V1_URLS_PATCH_RESTORE',
  LIST: 'KURTTO_V1_URLS_GET_LIST',
  GET_BY_CODE: 'KURTTO_V1_URLS_GET_BY_CODE',
  UPDATE: 'KURTTO_V1_URLS_PATCH_UPDATE',
  DELETE: 'KURTTO_V1_URLS_DELETE_BY_CODE',
} as const;

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
  authorizeRoute(() => true, () => URL_ROUTE_CODES.CREATE),
  postUrlsRateLimiter,
  validateBody(CreateUrlSchema),
  (req, res, next) => {
    void urlController.create(req, res).catch(next);
  },
);

/**
 * @swagger
 * /urls/{code}/restore:
 *   patch:
 *     summary: Reativa URL soft-deleted
 *     tags: [Urls]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Restaurado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       401:
 *         description: Token ausente/invalido/expirado
 *       403:
 *         description: Proibido (sem permissao na rota)
 *       404:
 *         description: Codigo inexistente
 *       422:
 *         description: URL nao esta soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
urlRouter.patch(
  '/:code/restore',
  authorizeRoute(() => true, () => URL_ROUTE_CODES.RESTORE),
  (req, res, next) => {
    void urlController.restore(req, res).catch(next);
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
 *       - in: query
 *         name: include_deleted
 *         description: Inclui URLs soft-deleted (exige Bearer token autorizado)
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: q
 *         description: Busca textual em codigo curto, URL original e URL curta (prefixo BASE_URL)
 *         schema:
 *           type: string
 *           maxLength: 200
 *     responses:
 *       200:
 *         description: Lista paginada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Token ausente/invalido
 *       403:
 *         description: Sem permissao na rota
 *       422:
 *         description: Query invalida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
urlRouter.get(
  '/',
  authorizeRoute(() => true, () => URL_ROUTE_CODES.LIST),
  (req, res, next) => {
    void urlController.list(req, res).catch(next);
  },
);

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
 *       - in: query
 *         name: include_deleted
 *         description: Inclui registro soft-deleted (exige Bearer token autorizado)
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: Encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       401:
 *         description: Token ausente/invalido
 *       403:
 *         description: Sem permissao na rota
 *       404:
 *         description: Nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
urlRouter.get(
  '/:code',
  authorizeRoute(() => true, () => URL_ROUTE_CODES.GET_BY_CODE),
  (req, res, next) => {
    void urlController.getByCode(req, res).catch(next);
  },
);

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
  authorizeRoute(() => true, () => URL_ROUTE_CODES.UPDATE),
  validateBody(PatchUrlSchema),
  (req, res, next) => {
    void urlController.patch(req, res).catch(next);
  },
);

/**
 * @swagger
 * /urls/{code}:
 *   delete:
 *     summary: Soft delete (marca deleted_at; nao remove a linha)
 *     tags: [Urls]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removido logicamente (sem corpo)
 *       404:
 *         description: Nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
urlRouter.delete(
  '/:code',
  authorizeRoute(() => true, () => URL_ROUTE_CODES.DELETE),
  (req, res, next) => {
    void urlController.remove(req, res).catch(next);
  },
);

export default urlRouter;
