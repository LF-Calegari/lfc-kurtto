/**
 * UUID sentinela para linhas sem proprietário real atribuído (dados legados na
 * migração e criações pela API pública até haver vínculo com identidade).
 * Deve coincidir com o valor usado em `AddOwnerIdToUrls` (migração).
 */
export const LEGACY_UNASSIGNED_OWNER_ID =
  '00000000-0000-0000-0000-000000000001' as const;
