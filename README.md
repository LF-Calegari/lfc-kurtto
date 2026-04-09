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

## Scripts

- `npm run dev`: inicia ambiente de desenvolvimento com watch e debug.
- `npm run build`: compila TypeScript para `dist`.
- `npm run start`: executa build em modo producao.
- `npm run typecheck`: valida tipos sem gerar build.
- `npm run lint`: executa lint do projeto.
- `npm run test`: executa testes de integracao (requer PostgreSQL acessivel; veja secao **Banco e testes**).
- `npm run test:coverage`: executa testes com geracao de cobertura `lcov` em `coverage/lcov.info`.
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

### Testes com PostgreSQL

Os testes que exercitam health com banco e o seed assumem um Postgres acessivel. Exemplo com servico local na porta 5432:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kurtto
npm run migration:run
npm test
```

No CI (SonarCloud), o workflow sobe Postgres 18 (imagem `postgres:18-alpine`), roda `migration:run` e em seguida lint, typecheck e testes.

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

Executar testes via profile:

```bash
docker compose --profile test run --rm test
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
  entities/
  middlewares/
  migrations/
  routes/
  seeds/
  app.ts
  bootstrap.ts
  server.ts
test/
```

## Licenca

ISC
