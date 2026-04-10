# Kurtto Service

API base do projeto Kurtto para evolucao de funcionalidades de encurtamento de links.

## Objetivo do projeto (semantico)

Fornecer uma API HTTP para criacao, consulta e gestao de links encurtados, com foco em
confiabilidade, padronizacao de contratos e facilidade de evolucao do dominio ao longo
do tempo.

## Stack

- Node.js 24 LTS (Alpine em Docker)
- TypeScript
- Express.js
- PostgreSQL 18
- Docker / Docker Compose

## Pre-requisitos

- Node.js 24 LTS+
- Docker e Docker Compose

## Getting started

1. Copie as variaveis de ambiente:
   - `cp .env.example .env`
2. Instale dependencias:
   - `npm install`
3. Rode localmente:
   - `npm run dev`

API disponivel em `http://localhost:3000/api/v1`.

## Link curto na raiz (redirecionamento)

Rotas versionadas ficam em `/api/v1`. O acesso publico ao link curto usa **`GET /:code`** na raiz do host (ex.: `https://seu-dominio/abc12xY`), registrado **depois** de `app.use('/api/v1', ...)` para nao capturar caminhos da API.

Fluxo:

1. Cliente solicita `GET /{short_code}`.
2. Se o codigo existir, estiver ativo e nao expirado: resposta **`302 Found`** com cabecalho **`Location`** apontando para a `original_url`, **`Cache-Control: no-cache, no-store, must-revalidate`**, e incremento atomico de `clicks` de forma assincrona apos o envio da resposta (falhas no incremento sao registradas em log, sem afetar o redirect).
3. Codigo inexistente: **`404`** JSON (`URL not found`).
4. Link inativo: **`410 Gone`** JSON (mensagem distinta de expirado).
5. Link expirado: persiste `is_active = false`, **`410 Gone`** JSON (mensagem distinta de inativo).

## Endpoints (API v1)

| Metodo | Caminho | Descricao |
| ------ | ------- | --------- |
| `GET` | `/:code` | Redirecionamento publico para `original_url` (`302` + cache desabilitado; `404` / `410` conforme regras acima). |
| `POST` | `/api/v1/urls` | Cria link encurtado (`201` com `short_url` a partir de `BASE_URL`; `409` se `custom_code` duplicado; `422` em validacao). |
| `GET` | `/api/v1/urls` | Lista paginada (`page` padrao 1, `limit` padrao 10, max 100; `active` opcional `true`/`false`; meta `page`, `limit`, `total`, `total_pages`; ordenacao `created_at` DESC). |
| `GET` | `/api/v1/urls/:code` | Detalhe por `short_code` (`200` ou `404` URL not found). |
| `PATCH` | `/api/v1/urls/:code` | Atualizacao parcial (sem `short_code`/`clicks`; `404` se inexistente). |
| `DELETE` | `/api/v1/urls/:code` | Remocao fisica (`204` ou `404`). |

## Scripts

- `npm run dev`: inicia ambiente de desenvolvimento com watch e debug.
- `npm run build`: compila TypeScript para `dist`.
- `npm run start`: executa build em modo producao.
- `npm run typecheck`: valida tipos sem gerar build.
- `npm run lint`: executa lint do projeto.
- `npm run test`: executa a suite **Jest** (ESM + `ts-jest`; requer PostgreSQL com migrations aplicadas; veja **Testes** abaixo).
- `npm run test:watch` / `npm run test:unit` / `npm run test:integration`: variantes Jest com `--runInBand --forceExit`.
- `npm run test:coverage`: Jest com `--coverage`, relatorio `coverage/lcov.info` e thresholds globais (branches 70%; demais 80%).
- `npm run typeorm`: atalho para a CLI do TypeORM via `tsx`.
- `npm run migration:generate`: gera migration a partir do diff das entidades (executa `npm run build` antes; substitua `MigrationName` no script por um nome descritivo ou passe o caminho desejado; usa `dist/config/data-source.js` como DataSource).
- `npm run migration:run` / `npm run migration:revert`: aplica ou reverte migrations usando `src/config/data-source.ts`.
- `npm run seed`: executa o seed idempotente de URLs de desenvolvimento (`src/seeds/url.seed.cli.entry.ts`; logica em `url.seed.cli.ts`).

## Banco de dados (TypeORM)

- DataSource centralizado em `src/config/data-source.ts`: `synchronize` desligado; `logging` apenas com `NODE_ENV=development`.
- Conexao: use `DATABASE_URL` **ou** `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` (com opcionais `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` como alias documentados na issue).
- Apos subir o Postgres (local ou Docker), aplique as migrations: `npm run migration:run`.
- UUIDs na tabela `urls`: a migration define default `gen_random_uuid()`; o DataSource usa `uuidExtension: 'pgcrypto'` para alinhar ao TypeORM (o driver cria `CREATE EXTENSION IF NOT EXISTS pgcrypto` quando necessario). Em PostgreSQL 13+, `gen_random_uuid()` tambem esta disponivel no nucleo; manter `pgcrypto` e a escolha explicita do projeto para consistencia com o TypeORM.
- Seeds de desenvolvimento: `npm run seed` (segunda execucao nao duplica por `short_code`).

### Testes (Jest + Supertest)

- Configuracao: `jest.config.ts`, `jest.setup.ts` (`reflect-metadata`), `tsconfig.jest.json`.
- Pastas: `tests/unit` (*.spec.ts), `tests/integration` (*.spec.ts), helpers em `tests/helpers` (`env-test.ts` aplica `DATABASE_URL_TEST` sobre `DATABASE_URL` quando definido; `setup.ts` com `useIntegrationDatabase()` para integracao: `initialize` + `TRUNCATE urls` entre casos).
- No processo Jest, o TypeORM **nao** carrega arquivos de migration via glob (evita conflito com VM modules); aplique migrations **antes** dos testes (`npm run migration:run`). O servico Docker de teste executa `migration:run && npm test` automaticamente.
- Exemplo local (Postgres na porta 5432):

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kurtto
npm run migration:run
npm test
```

No CI (SonarCloud), o workflow sobe Postgres 18 (`postgres:18-alpine`), roda `migration:run` e em seguida lint, typecheck e `npm run test:coverage`.

## Docker

Subir API + PostgreSQL:

```bash
docker compose up --build
```

Se voce estiver migrando de uma configuracao anterior (volume montado em
`/var/lib/postgresql/data`) para outra versao major do PostgreSQL, remova o volume legado local:

```bash
docker compose down -v
```

> Atencao: o comando acima remove os dados locais do banco.

Executar testes via profile (aplica migrations e roda Jest):

```bash
docker compose --profile test run --rm test
```

Aplicar migrations via profile dedicado:

```bash
docker compose --profile migrate run --rm migrate
```

## Logging

- **Winston** (`src/config/logger.ts`): em `production`, saida JSON no nivel **info** (ou `LOG_LEVEL`); timestamp em ISO; meta como `context` (ex.: `http`, `url`, `error`, `bootstrap`, `redirect`, `process`). Em `development` e `test`, formato colorido simples no nivel **debug** por padrao.
- **Request log** (`src/middlewares/requestLogger.ts`): ao final da resposta, registra metodo, path, status e duracao em ms; **sem body**; nivel **info** se status &lt; 400, **warn** para 4xx, **error** para 5xx. Por padrao **nao** registra `GET /api/v1/health`; ajuste com `REQUEST_LOG_SKIP_PATHS` (CSV de paths; vazio desativa o filtro).
- **Erros**: hierarquia em `src/errors/` (`AppError`, `NotFoundError`, `ConflictError`, `ValidationError`); `errorHandler` central trata `instanceof`, loga com Winston e inclui `stack` na resposta JSON apenas em ambiente nao produto para erros 500 nao operacionais.
- **Processo**: `uncaughtException` e `unhandledRejection` em `src/server.ts` registram com Winston e encerram o processo com codigo 1.

## Seguranca

- **Helmet**: cabecalhos HTTP de seguranca com configuracao padrao em todas as respostas.
- **CORS**: em `development` e `test`, sem `CORS_ORIGINS`, qualquer origem e aceita (`*`). Em `production`, defina `CORS_ORIGINS` como lista CSV (ex.: `https://app.exemplo.com,https://admin.exemplo.com`). Metodos permitidos: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`. Cabecalhos permitidos: `Content-Type`, `Authorization`.
- **Rate limiting** (`express-rate-limit`, armazenamento em memoria por processo):
  - Global: `RATE_LIMIT_GLOBAL_MAX` requisicoes por `RATE_LIMIT_GLOBAL_WINDOW_MS` (padrao **100 / 15 min**). Cabecalhos `RateLimit-*` habilitados; cabecalhos legados `X-RateLimit-*` desligados.
  - `POST /api/v1/urls`: padrao **10 / 15 min** (`RATE_LIMIT_POST_URLS_*`).
  - `GET /:code` (redirect publico): padrao **60 / 1 min** (`RATE_LIMIT_REDIRECT_*`).
  - Resposta **429** com corpo JSON: `error`, `message`, `retry_after` (segundos ate a janela resetar).
  - Em ambientes com varias replicas, o limite nao e compartilhado; para limite global consistente, avalie store externo (ex.: Redis) em evolucao futura.
- **Sanitizacao de body**: `trim` em strings; remocao de tags HTML em campos textuais, exceto `originalUrl` / `original_url` (apenas trim, para nao corromper URLs).

Testar CORS localmente (exemplo):

```bash
curl -sI -X OPTIONS "http://localhost:3000/api/v1/urls" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"
```

## CI SonarCloud

O workflow `.github/workflows/sonarcloud.yml` executa em `push` e `pull_request` nas branches `main` e `development`.

Segredos obrigatorios no repositorio GitHub:

- `SONAR_TOKEN`
- `SONAR_ORGANIZATION`
- `SONAR_PROJECT_KEY`

Para a analise funcionar, o pipeline gera cobertura `lcov` no caminho `coverage/lcov.info`, usado na propriedade `sonar.javascript.lcov.reportPaths`.

## Debug

Perfis VS Code disponiveis em `.vscode/launch.json`:

- `Kurtto: Attach to Docker`
- `Kurtto: Local Dev`

## Estrutura

```txt
src/
  config/
  controllers/
  errors/
  entities/
  middlewares/
  migrations/
  routes/
  seeds/
  app.ts
  bootstrap.ts
  server.ts
tests/
  unit/
  integration/
  helpers/
```

## Licenca

ISC
