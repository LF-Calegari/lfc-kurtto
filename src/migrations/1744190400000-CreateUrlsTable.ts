import { type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateUrlTable1744190400000 implements MigrationInterface {
  name = 'CreateUrlTable1744190400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'urls',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'PK_urls_id',
            default: 'gen_random_uuid()',
          },
          {
            name: 'original_url',
            type: 'text',
          },
          {
            name: 'short_code',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'clicks',
            type: 'integer',
            default: 0,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'IDX_urls_short_code',
            columnNames: ['short_code'],
            isUnique: true,
          },
          {
            name: 'IDX_urls_created_at',
            columnNames: ['created_at'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('urls');
  }
}
