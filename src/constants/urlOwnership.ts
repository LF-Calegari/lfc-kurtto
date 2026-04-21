/**
 * UUID sentinela para linhas sem proprietário real atribuído (dados legados na
 * migração de backfill). Após a introdução do escopo por `owner_id`, esse
 * valor existe apenas para representar registros legados sem owner real.
 * Deve coincidir com o valor usado em `AddOwnerIdToUrls` (migração).
 */
export const LEGACY_UNASSIGNED_OWNER_ID =
  '00000000-0000-0000-0000-000000000001' as const;

export function isLegacyUnassignedOwnerId(
  ownerId: string | null | undefined,
): boolean {
  return ownerId === LEGACY_UNASSIGNED_OWNER_ID;
}
