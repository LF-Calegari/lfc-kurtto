import type { Request } from 'express';
import { Router } from 'express';

import urlController from '@controllers/UrlController';
import { postUrlsRateLimiter } from '@middlewares/rateLimit';
import { authorizeRoute } from '@middlewares/routeAuthorization';
import { validateBody } from '@middlewares/validate';
import { CreateUrlSchema, PatchUrlSchema } from '../dtos/UrlDto.js';

const urlRouter = Router();

/**
 * RouteCodes publicados pelo auth-service (ver `KurttoAccessSeeder` em
 * lfc-calegari-sistemas/auth-service). Apenas as rotas "admin" abaixo
 * exigem autorização:
 * - listar/obter com `include_deleted=true`
 * - reativar uma URL soft-deleted
 * As demais (POST, PATCH update, DELETE soft) são públicas.
 */
const URL_ROUTE_CODES = {
  RESTORE: 'KURTTO_V1_URLS_PATCH_RESTORE',
  LIST_INCLUDE_DELETED: 'KURTTO_V1_URLS_LIST_INCLUDE_DELETED',
  GET_BY_CODE_INCLUDE_DELETED: 'KURTTO_V1_URLS_GET_BY_CODE_INCLUDE_DELETED',
} as const;

function includeDeletedRequested(req: Request): boolean {
  const raw = req.query?.include_deleted;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.toLowerCase() === 'true';
}

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

// --- rotas de leitura: auth somente quando include_deleted=true ---

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
 *         description: Filtra por ativo (string "true" ou "false"). Se is_active__exact tambem for enviado, is_active__exact prevalece.
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
 *         name: is_active__exact
 *         description: Filtro exato de is_active ("true"/"false"); prevalece sobre o parametro active quando ambos existem.
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: id__exact
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: id__like
 *         description: Correspondencia parcial ILIKE sobre o UUID em texto (use % como curinga).
 *         schema: { type: string, maxLength: 200 }
 *       - in: query
 *         name: original_url__exact
 *         schema: { type: string }
 *       - in: query
 *         name: original_url__like
 *         description: ILIKE em original_url (use % como curinga).
 *         schema: { type: string, maxLength: 200 }
 *       - in: query
 *         name: short_code__exact
 *         schema: { type: string, maxLength: 10 }
 *       - in: query
 *         name: short_code__like
 *         description: ILIKE em short_code (use % como curinga).
 *         schema: { type: string, maxLength: 200 }
 *       - in: query
 *         name: clicks__lt
 *         schema: { type: integer }
 *       - in: query
 *         name: clicks__gt
 *         schema: { type: integer }
 *       - in: query
 *         name: clicks__exact
 *         schema: { type: integer }
 *       - in: query
 *         name: clicks__between
 *         description: Dois inteiros separados por virgula, intervalo fechado (ex. 0,100).
 *         schema: { type: string }
 *       - in: query
 *         name: expires_at__lt
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: expires_at__gt
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: expires_at__exact
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: expires_at__between
 *         description: Dois ISO 8601 separados por virgula, intervalo fechado (UTC).
 *         schema: { type: string }
 *       - in: query
 *         name: created_at__lt
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: created_at__gt
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: created_at__exact
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: created_at__between
 *         description: Dois ISO 8601 separados por virgula, intervalo fechado (UTC).
 *         schema: { type: string }
 *       - in: query
 *         name: updated_at__lt
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: updated_at__gt
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: updated_at__exact
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: updated_at__between
 *         description: Dois ISO 8601 separados por virgula, intervalo fechado (UTC).
 *         schema: { type: string }
 *       - in: query
 *         name: deleted_at__lt
 *         description: Combinar com include_deleted=true para filtrar linhas soft-deleted.
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: deleted_at__gt
 *         description: Combinar com include_deleted=true para filtrar linhas soft-deleted.
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: deleted_at__exact
 *         description: Combinar com include_deleted=true para filtrar linhas soft-deleted.
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: deleted_at__between
 *         description: Dois ISO 8601 separados por virgula, intervalo fechado (UTC); usar com include_deleted=true para tumbas.
 *         schema: { type: string }
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
  authorizeRoute(
    includeDeletedRequested,
    () => URL_ROUTE_CODES.LIST_INCLUDE_DELETED,
  ),
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
  authorizeRoute(
    includeDeletedRequested,
    () => URL_ROUTE_CODES.GET_BY_CODE_INCLUDE_DELETED,
  ),
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
  (req, res, next) => {
    void urlController.remove(req, res).catch(next);
  },
);

export default urlRouter;
