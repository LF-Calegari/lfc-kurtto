# kurtto-api — instruções para agentes

## Cursor Cloud (GitHub App + Cloud Agents)

Este repositório define o ambiente em [`.cursor/environment.json`](.cursor/environment.json). O `start` sobe Postgres 18 e Redis via Docker (paridade com o CI).

### Disparar pelo celular ou pelo GitHub

1. Conecte o repositório em [Cursor → Integrations → GitHub](https://cursor.com/dashboard/integrations).
2. Em uma **issue**, comente:

```text
@cursor implemente esta issue no repositório kurtto-api.

Regras:
- Leia a issue completa (What, Why, ARO, testes, DoD).
- Branch: feature/<numero>/<descricao-curta-em-ingles>
- Siga .cursor/agents/programmer.md e programmer-lessons.md
- PR: título "#<numero> | <titulo da issue>", sem merge
- Quality gate: npm run typecheck && npm run lint && npm run test:coverage
```

Substitua `<numero>` e o escopo conforme a issue.

### Secrets (dashboard)

Configure em [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) apenas se a tarefa exigir (integração real com auth-service, APIs externas, etc.). Para a maioria das issues, Postgres/Redis locais do `cloud-start.sh` bastam.

Variáveis usadas no CI (referência para testes):

| Variável | Valor típico (cloud local) |
|----------|----------------------------|
| `NODE_ENV` | `test` |
| `KURTTO_TEST_DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/kurtto_test` |
| `DATABASE_URL` | igual à de teste durante `npm test` |
| `BASE_URL` | `http://localhost:3000` |
| `AUTH_SERVICE_URL` | `http://127.0.0.1:5052` (mock/offline nos testes) |

### Comandos após o ambiente subir

```bash
export NODE_ENV=test
export KURTTO_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kurtto_test
export DATABASE_URL="$KURTTO_TEST_DATABASE_URL"
export BASE_URL=http://localhost:3000
export SHORT_CODE_LENGTH=7
export AUTH_SERVICE_URL=http://127.0.0.1:5052

NODE_ENV=development DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kurtto npm run migration:run

npm run typecheck
npm run lint
npm run test:coverage
```

### Implementação de issues

- Agente de referência: [`.cursor/agents/programmer.md`](.cursor/agents/programmer.md)
- Lições de review: [`.cursor/agents/programmer-lessons.md`](.cursor/agents/programmer-lessons.md)
- Branch: `feature/<issue-number>/<short-description-in-english>`
- PR: `#<issue-number> | <issue title>` — não fazer merge

### Docker Compose completo (opcional)

Se precisar do stack com rede `lfc_platform_network` (ex.: auth-service real):

```bash
docker network create lfc_platform_network 2>/dev/null || true
docker compose up -d db redis
```

Para testes isolados, prefira o fluxo CI acima (mais rápido no Cloud Agent).
