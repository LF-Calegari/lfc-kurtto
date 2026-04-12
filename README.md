# Kurtto Service

[![CI](https://github.com/LF-Calegari/lfc-kurtto/actions/workflows/ci.yml/badge.svg?branch=development)](https://github.com/LF-Calegari/lfc-kurtto/actions/workflows/ci.yml)

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
| `GET` | `/api/v1/health/live` | Liveness: processo vivo (`200`, sem checagem de banco/cache). |
| `GET` | `/api/v1/health/ready` | Readiness: PostgreSQL acessivel; com `REDIS_URL` definido, Redis tambem deve responder (`200` ready ou `503` not_ready). |
| `GET` | `/:code` | Redirecionamento publico para `original_url` (`302` + cache desabilitado; `404` / `410` conforme regras acima). |
| `POST` | `/api/v1/urls` | Cria link encurtado (`201` com `short_url` a partir de `BASE_URL`; `409` se `custom_code` duplicado; `422` em validacao). |
| `GET` | `/api/v1/urls` | Lista paginada (`page` padrao 1, `limit` padrao 10, max 100; `active` opcional `true`/`false`; `include_deleted=true` inclui soft-deleted com header `X-Admin-Secret` igual a `ADMIN_API_SECRET`; `403` se secret ausente/invalido; meta `page`, `limit`, `total`, `total_pages`; ordenacao `created_at` DESC). |
| `GET` | `/api/v1/urls/:code` | Detalhe por `short_code` (`200` ou `404`). `include_deleted=true` + `X-Admin-Secret` retorna registro soft-deleted. Respostas incluem `deletedAt` (`null` ou ISO 8601). |
| `PATCH` | `/api/v1/urls/:code` | Atualizacao parcial (sem `short_code`/`clicks`; `404` se inexistente ou soft-deleted). |
| `DELETE` | `/api/v1/urls/:code` | Soft delete: preenche `deleted_at` (`204` ou `404`; segundo delete do mesmo codigo -> `404`). |
| `POST` | `/api/v1/urls/:code/restore` | Remove soft delete (`200` + corpo URL; exige `X-Admin-Secret`; `404` codigo inexistente; `422` se nao estava soft-deleted; `403` se admin nao configurado ou secret invalido). |

## Documentacao interativa (Swagger)

- **UI:** `GET /api/docs` (redireciona para `/api/docs/`) — Swagger UI com *Try it out*.
- **Spec JSON:** `GET /api/docs.json` — OpenAPI 3.0 gerada com `swagger-jsdoc` a partir dos comentarios nas rotas em `src/routes/*.ts` e da definicao base em `src/config/swagger.ts` (info **Kurtto API 1.0.0**, servidores `/api/v1` e `/`, *tags* Health, Urls, Redirect, *schemas* compartilhados).
- **Producao:** com `NODE_ENV=production`, a documentacao so e exposta se `SWAGGER_ENABLED=true`. Caso contrario (incluindo ausencia da variavel), as rotas `/api/docs` e `/api/docs.json` nao sao registradas. Em development/test o padrao e habilitado; use `SWAGGER_ENABLED=false` para desligar.

## Scripts

- `npm run dev`: inicia ambiente de desenvolvimento com watch e debug.
- `npm run build`: compila TypeScript para `dist`.
- `npm run start`: executa build em modo producao.
- `npm run typecheck`: valida tipos sem gerar build.
- `npm run lint`: executa lint do projeto (ESLint 9, config plana em `eslint.config.mjs`).
- `npm run lint:fix`: aplica correcoes automaticas do ESLint quando possivel.
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
- Pastas: `tests/unit` (*.spec.ts), `tests/integration` (*.spec.ts), helpers em `tests/helpers`. **Banco de teste (padrão alinhado ao auth-service):** em `NODE_ENV=test`, o DataSource usa `KURTTO_TEST_DATABASE_URL` (ou `DATABASE_URL_TEST` legado) com precedência sobre `DATABASE_URL`. O helper `useIntegrationDatabase()` exige uma dessas URLs (ou `KURTTO_INTEGRATION_USE_ENV_DATABASE=true`) para evitar rodar integração contra o Postgres de desenvolvimento por engano. `env-test.ts` deriva, por worker Jest, uma URL com banco `nome_base_w` + `JEST_WORKER_ID` (ex.: `kurtto_test_w2`; sem worker id, mantém o nome base) e replica em `DATABASE_URL`. `setup.ts`: `CREATE DATABASE` idempotente se necessário, `initialize`, `runMigrations()` na primeira conexão do worker e `TRUNCATE urls` entre casos. Se `KURTTO_TEST_DATABASE_DROP_AFTER_RUN=true`, o helper fecha conexões e executa `DROP DATABASE IF EXISTS` do banco derivado ao final de cada arquivo de teste.
- No Jest, migrations são registradas como classes (evita glob + VM modules no runner); cada worker aplica as pendentes no próprio banco derivado. O servico Docker com profile `test` executa só `npm test` (sem `migration:run` prévio obrigatório).
- Execução serial (um processo): `npx jest --runInBand` (ou `JEST_WORKER_ID` ausente fora do Jest continua usando o banco base da URL).
- Exemplo local (Postgres na porta 5432):

```bash
# Banco de desenvolvimento (migrations)
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kurtto
npm run migration:run

# URL *base* de teste: crie `kurtto_test` uma vez (ex.: CREATE DATABASE kurtto_test;).
# Cada worker Jest cria/usará `kurtto_test_w1`, `kurtto_test_w2`, etc., e aplica migrations automaticamente.
export KURTTO_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kurtto_test
# Opcional: limpar bancos derivados automaticamente após cada arquivo de teste.
# export KURTTO_TEST_DATABASE_DROP_AFTER_RUN=true
npm test
```

No GitHub Actions, o workflow **CI** (`.github/workflows/ci.yml`) executa em `push` em `main` e `development` e em `pull_request` para `main`: job `lint-and-typecheck` (Node 24, `npm ci`, `typecheck`, `lint`) e job `test` com Postgres 18, `pg_isready`, `migration:run` no banco `kurtto`, `DATABASE_URL_TEST` / `KURTTO_TEST_DATABASE_URL`, `npm run test:coverage` e *artifact* `coverage/`. O workflow SonarCloud (`.github/workflows/sonarcloud.yml`) também gera `coverage/lcov.info` para análise e sobe Postgres 18 com as mesmas variáveis de teste; migrations adicionais continuam sendo aplicadas por worker durante os testes de integração.

No Docker Compose, o script `docker/postgres/create-test-db.sh` cria `kurtto_test` na primeira inicialização do volume; o serviço com profile `test` já exporta `KURTTO_TEST_DATABASE_URL` apontando para esse banco.

## Cache de redirect (Redis)

- **Opcional:** com `REDIS_URL` (ex.: `redis://localhost:6379`), o `GET /:code` usa Redis (chave `url:{code}`, JSON com `original_url`, `is_active`, `expires_at`, TTL `REDIS_CACHE_TTL` segundos, padrão **3600**). *Miss* carrega do PostgreSQL e repovoa o cache; *hit* válido evita consulta ao banco.
- **Invalidação:** `PATCH` e `DELETE` em `/api/v1/urls/:code`; detecção de `expires_at` vencido no redirect remove a chave e reconsulta o PG.
- **Sem Redis:** omita `REDIS_URL` — a API segue só com PostgreSQL.
- **Health:** `GET /api/v1/health` inclui `cache`: `connected` | `disconnected`. Redis indisponível **não** força `503` se o banco estiver ok. Probes Kubernetes/ECS: **`GET /api/v1/health/live`** (liveness) e **`GET /api/v1/health/ready`** (readiness; com Redis configurado, ambos devem estar ok).
- **Docker Compose:** o serviço `redis` (imagem `redis:8.6-alpine` com *healthcheck*) sobe com a API; `api` aguarda `redis` e `db` saudáveis.

## Docker

Subir API + PostgreSQL + Redis:

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

## Producao

- **Imagem:** o stage `production` do `Dockerfile` usa `NODE_ENV=production`, dependencias sem dev, `USER node`, `STOPSIGNAL SIGTERM`, `HEALTHCHECK` em `GET http://127.0.0.1:3000/api/v1/health/live` (requer `wget` na imagem base Alpine; ja presente no `node:24-alpine`).
- **Compose:** `docker-compose.prod.yml` sobrescreve o servico `api` para `build.target: production`, `restart: unless-stopped`, remove o volume de codigo fonte e expoe apenas a porta da aplicacao (sem `9229` de debug). Exemplo:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api
```

- Defina `CORS_ORIGINS` e demais variaveis sensiveis no ambiente; nao commite segredos.

## Logging

- **Winston** (`src/config/logger.ts`): em `production`, saida JSON no nivel **info** (ou `LOG_LEVEL`); timestamp em ISO; meta como `context` (ex.: `http`, `url`, `error`, `bootstrap`, `redirect`, `process`). Em `development` e `test`, formato colorido simples no nivel **debug** por padrao.
- **Request log** (`src/middlewares/requestLogger.ts`): ao final da resposta, registra metodo, path, status e duracao em ms; **sem body**; nivel **info** se status &lt; 400, **warn** para 4xx, **error** para 5xx. Por padrao **nao** registra `GET` em `/api/v1/health`, `/api/v1/health/live` nem `/api/v1/health/ready`; ajuste com `REQUEST_LOG_SKIP_PATHS` (CSV de paths; vazio desativa o filtro).
- **Erros**: hierarquia em `src/errors/` (`AppError`, `NotFoundError`, `ConflictError`, `ValidationError`); `errorHandler` central trata `instanceof`, loga com Winston e inclui `stack` na resposta JSON apenas em ambiente nao produto para erros 500 nao operacionais.
- **Processo**: `uncaughtException` e `unhandledRejection` em `src/server.ts` registram com Winston e encerram o processo com codigo 1. **Encerramento ordenado** (`SIGTERM` / `SIGINT`): `src/config/graceful-shutdown.ts` registra o sinal, chama `server.close()`, aguarda ate `GRACEFUL_SHUTDOWN_TIMEOUT_MS` (padrao **30000**), encerra TypeORM (`destroy`) e Redis (`quit`); **exit 1** apenas em timeout de shutdown ou erro ao fechar o HTTP server; caso contrario **exit 0**.
- **Compressao** (`compression`): respostas JSON acima de **1 KB** podem usar gzip/deflate quando o cliente envia `Accept-Encoding` adequado; rotas fora de `/api` (ex.: `GET /:code` de redirect) **nao** passam pelo filtro de compressao.

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

## CI/CD

### GitHub Actions (CI)

- **Workflow:** `.github/workflows/ci.yml` (badge no topo deste README).
- **Gatilhos:** `push` em `main` e `development`; `pull_request` para `main`.
- **Jobs:** validacao de tipos e ESLint; testes com Postgres 18, migrations e cobertura com *upload* do diretorio `coverage/` como *artifact*.

### Branch protection (recomendado)

No GitHub: **Settings** > **Branches** > *Add branch protection rule* (ou regra existente) para `main` e, se aplicavel, `development`:

- Exigir *pull request* antes do merge (sem *push* direto em `main`).
- Exigir que os *status checks* obrigatorios passem (inclua os jobs do workflow **CI** e, se usar, o SonarCloud / *Quality Gate*).
- Exigir revisao de codigo quando a politica do time assim definir.
- Considerar **Require linear history** ou **Require branches to be up to date** conforme fluxo de release.

### SonarCloud

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
