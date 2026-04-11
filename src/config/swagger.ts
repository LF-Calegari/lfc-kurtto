import type { Express } from 'express';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { env } from '@config/env';
import { logger } from '@config/logger';

const currentDirPath = path.dirname(fileURLToPath(import.meta.url));

/** Base pública dos assets estáticos do Swagger (espelha o padrão swagger-static do authenticator). */
const SWAGGER_STATIC_BASE = '/api/swagger-static';

/** Em dev: `src/swagger`; em produção (dist): `dist/swagger` (copiado no `npm run build`). */
const getSwaggerAssetsRoot = (): string =>
  path.resolve(currentDirPath, '../swagger');

const getRouteApiGlobs = (): string[] => {
  const isProduction = process.env.NODE_ENV === 'production';
  const srcOrDistRoot = path.resolve(currentDirPath, '..');
  if (isProduction) {
    return [path.join(srcOrDistRoot, 'routes', '**', '*.js')];
  }
  return [path.join(srcOrDistRoot, 'routes', '**', '*.ts')];
};

const openApiDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'kurtto API',
    version: '1.0.0',
    description:
      'API HTTP para **criar, consultar e atualizar** links encurtados e ' +
      'para documentar o **redirecionamento publico** na raiz do host.\n\n' +
      '### Como usar esta documentacao\n' +
      '- Escolha o servidor **API versionada (v1)** para operacoes da API.\n' +
      '- O servidor **Raiz** descreve o fluxo `GET /{codigo}` de ' +
      'redirecionamento.\n' +
      '- Em cada operacao, use **Try it out** para enviar requisicoes de ' +
      'teste.\n\n' +
      'Contratos e codigos de resposta seguem a implementacao atual do ' +
      'servico.',
    'x-logo': {
      url: `${SWAGGER_STATIC_BASE}/images/kurtto-logo-compact.svg`,
      altText: 'kurtto',
      backgroundColor: '#FFFFFF',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API versionada (v1)',
    },
    {
      url: '/',
      description: 'Raiz do host (redirecionamento de links curtos)',
    },
  ],
  tags: [
    {
      name: 'Health',
      description:
        'Verificacao de disponibilidade da API e conectividade com o banco.',
    },
    {
      name: 'Urls',
      description:
        'Criacao, listagem, detalhe, atualizacao e remocao de URLs ' +
        'encurtadas.',
    },
    {
      name: 'Redirect',
      description:
        'Acesso publico ao link curto: redirecionamento 302 para a URL ' +
        'original.',
    },
  ],
  components: {
    schemas: {
      UrlResponse: {
        type: 'object',
        required: [
          'id',
          'originalUrl',
          'shortCode',
          'shortUrl',
          'clicks',
          'isActive',
          'expiresAt',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          originalUrl: { type: 'string', format: 'uri' },
          shortCode: { type: 'string' },
          shortUrl: { type: 'string', format: 'uri' },
          clicks: { type: 'integer', minimum: 0 },
          isActive: { type: 'boolean' },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateUrlRequest: {
        type: 'object',
        required: ['originalUrl'],
        properties: {
          originalUrl: { type: 'string', format: 'uri' },
          customCode: {
            type: 'string',
            pattern: '^[a-zA-Z0-9]{3,10}$',
            description: 'Opcional; se omitido, gera codigo automatico',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Data futura; opcional',
          },
        },
      },
      UpdateUrlRequest: {
        type: 'object',
        description:
          'Atualizacao parcial. Pelo menos um campo deve ser enviado ' +
          '(validado pela API).',
        properties: {
          originalUrl: { type: 'string', format: 'uri' },
          expiresAt: { type: 'string', format: 'date-time' },
          isActive: { type: 'boolean' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/UrlResponse' },
          },
          meta: {
            type: 'object',
            required: ['page', 'limit', 'total', 'total_pages'],
            properties: {
              page: { type: 'integer', minimum: 1 },
              limit: { type: 'integer', minimum: 1 },
              total: { type: 'integer', minimum: 0 },
              total_pages: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['error', 'details'],
        properties: {
          error: { type: 'string' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'message'],
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

export function buildSwaggerSpec(): Record<string, unknown> {
  return swaggerJSDoc({
    definition: openApiDefinition,
    apis: getRouteApiGlobs(),
  }) as Record<string, unknown>;
}

function registerSwaggerAssets(app: Express): void {
  app.use(
    SWAGGER_STATIC_BASE,
    express.static(getSwaggerAssetsRoot(), {
      maxAge: '1d',
      index: false,
      dotfiles: 'deny',
    }),
  );
}

export function setupSwagger(app: Express): void {
  if (!env.swaggerEnabled) {
    logger.info('Swagger UI desabilitado pela configuracao', {
      context: 'swagger',
      nodeEnv: env.NODE_ENV,
      SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? '(nao definido)',
    });
    return;
  }

  registerSwaggerAssets(app);

  const spec = buildSwaggerSpec();

  app.get('/api/docs.json', (_req, res) => {
    res.json(spec);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'kurtto API · documentação',
      customCssUrl: `${SWAGGER_STATIC_BASE}/css/swagger-custom.css`,
      customfavIcon: `${SWAGGER_STATIC_BASE}/images/kurtto-favicon.svg`,
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );
}
