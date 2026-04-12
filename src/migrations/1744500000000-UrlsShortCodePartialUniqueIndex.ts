import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Permite reutilizar `short_code` após soft delete: unicidade só entre linhas ativas
 * (`deleted_at IS NULL`).
 */
export class UrlsShortCodePartialUniqueIndex1744500000000
implements MigrationInterface
{
  name = 'UrlsShortCodePartialUniqueIndex1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_urls_short_code"');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_urls_short_code" ON "urls" ("short_code") ' +
        'WHERE "deleted_at" IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_urls_short_code"');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_urls_short_code" ON "urls" ("short_code")',
    );
  }
}
