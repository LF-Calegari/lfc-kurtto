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
- `npm run test`: executa testes de integracao.

## Docker

Subir API + PostgreSQL:

```bash
docker compose up --build
```

Se voce estiver migrando de uma configuracao anterior (volume montado em
`/var/lib/postgresql/data`) para PostgreSQL 18+, remova o volume legado local:

```bash
docker compose down -v
```

> Atencao: o comando acima remove os dados locais do banco.

Executar testes via profile:

```bash
docker compose --profile test run --rm test
```

## Debug

Perfis VS Code disponiveis em `.vscode/launch.json`:

- `Kurtto: Attach to Docker`
- `Kurtto: Local Dev`

## Estrutura

```txt
src/
  config/
  controllers/
  middlewares/
  routes/
  app.ts
  server.ts
test/
```

## Licenca

ISC
