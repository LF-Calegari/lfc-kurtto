import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUrlTable1744190400000 implements MigrationInterface {
  name = 'CreateUrlTable1744190400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
            CREATE TABLE "urls" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "original_url" text NOT NULL,
                "short_code" character varying(10) NOT NULL,
                "clicks" integer NOT NULL DEFAULT 0,
                "is_active" boolean NOT NULL DEFAULT true,
                "expires_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_urls_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_urls_short_code" ON "urls" ("short_code")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_urls_created_at" ON "urls" ("created_at")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "urls"');
  }
}
