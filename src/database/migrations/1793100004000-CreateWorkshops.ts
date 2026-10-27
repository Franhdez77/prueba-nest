import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkshops1793100004000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "workshop_status" AS ENUM ('ACTIVE', 'INACTIVE')`);
    await queryRunner.query(`CREATE TABLE "workshops" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar(100) NOT NULL,
      "address" varchar(255) NOT NULL,
      "status" "workshop_status" NOT NULL DEFAULT 'ACTIVE',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_workshops" PRIMARY KEY ("id")
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "workshops"');
    await queryRunner.query('DROP TYPE "workshop_status"');
  }
}
