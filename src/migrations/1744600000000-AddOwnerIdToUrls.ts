import {
  type MigrationInterface,
  type QueryRunner,
  TableColumn,
} from 'typeorm';

import { LEGACY_UNASSIGNED_OWNER_ID } from '../constants/urlOwnership.js';

export class AddOwnerIdToUrls1744600000000 implements MigrationInterface {
  name = 'AddOwnerIdToUrls1744600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'urls',
      new TableColumn({
        name: 'owner_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.query(
      'UPDATE urls SET owner_id = $1 WHERE owner_id IS NULL',
      [LEGACY_UNASSIGNED_OWNER_ID],
    );

    await queryRunner.query(
      'ALTER TABLE "urls" ALTER COLUMN "owner_id" SET NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('urls', 'owner_id');
  }
}
