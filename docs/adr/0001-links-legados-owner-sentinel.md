# ADR 0001: Links legados e `owner_id` sentinela

## Status

Aceito — alinhado ao código em `development` e às issues #60 (coluna `owner_id`), #61 (`req.user` / actor) e #62 (escopo por proprietário).

## Contexto

Antes da coluna `owner_id`, a tabela `urls` já continha registros. Foi necessário um backfill determinístico sem inventar donos reais, e um mecanismo de escopo nas operações autenticadas para que usuários comuns não enxerguem nem alterem dados que não lhes pertencem.

## Decisão

1. **UUID sentinela**  
   Linhas sem proprietário real recebem `owner_id = LEGACY_UNASSIGNED_OWNER_ID` (`00000000-0000-0000-0000-000000000001`), o mesmo valor aplicado na migration `AddOwnerIdToUrls` ao atualizar `NULL` → sentinela antes de tornar a coluna `NOT NULL`.  
   Constante única: `src/constants/urlOwnership.ts` (`isLegacyUnassignedOwnerId`).

2. **Política de backfill**  
   - Não há reatribuição automática de `owner_id` a partir de heurísticas.  
   - Novas URLs **nunca** podem ser criadas com o sentinela: `POST` valida e responde `422` se o `ownerId` do token for o sentinela.  
   - Reatribuição manual (SQL/operacional) permanece fora desta API; o sentinela continua válido apenas para linhas já migradas.

3. **Escopo nas operações autenticadas** (`UrlService` + `UrlRepository`)  
   - **Administrador Kurtto** (`isAdmin`): escopo `all` — vê e altera qualquer linha, inclusive com `owner_id` sentinela.  
   - **Usuário comum**: escopo `owner` com `ownerId === req.user.id` — não inclui linhas legadas (sentinela ≠ id do usuário).  
   - **Actor cujo `userId` é o sentinela e não é admin**: escopo `none` (lista vazia, demais operações como recurso inexistente). Caso patológico; evita tratar o sentinela como “dono” acidental.

4. **Comportamento por operação**  
   | Operação | Legado (sentinela) |
   |----------|---------------------|
   | `list` / `get` | Visível só para admin; usuário comum: como se não existisse (`404` no get; não aparece na lista). |
   | `patch` / `delete` / `restore` | Mesmo critério de escopo: só admin altera links legados; demais recebem `404` onde aplicável. |
   | Redirect público `GET /:code` | Não usa escopo por dono; segue regras de ativo/expiração/cache. |

5. **Observabilidade**  
   Para auditoria, quando `list`, `get`, `patch`, `delete` ou `restore` envolvem ao menos uma URL com `owner_id` sentinela, o serviço emite log estruturado (`legacy unassigned URL <ação>`) com `context: 'url'`, identificação do actor e metadados (ex.: `shortCode`, `count` em listagens).

## Consequências

- **Positivo**: contrato claro entre dados migrados e novos; sem vazamento de existência de links legados para não-admins nas rotas autenticadas.  
- **Negativo**: operação de “adotar” legado em massa exige processo externo (SQL ou ferramenta futura), não a API atual.

## Referências no repositório

- Migration: `src/migrations/1744600000000-AddOwnerIdToUrls.ts`  
- Domínio: `src/services/UrlService.ts` (`toOwnershipScope`, logs legados)  
- Persistência: `src/repositories/UrlRepository.ts` (`UrlOwnershipScope`, filtros por `ownerId`)
