import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMechanics1793100002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "mechanic_status" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(`CREATE TABLE "mechanics" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar(100) NOT NULL,
      "email" varchar(254) NOT NULL,
      "specialty" varchar(150) NOT NULL,
      "status" "mechanic_status" NOT NULL DEFAULT 'ACTIVE',
      "user_id" uuid,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_mechanics" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_mechanics_email" UNIQUE ("email"),
      CONSTRAINT "UQ_mechanics_user" UNIQUE ("user_id"),
      CONSTRAINT "FK_mechanics_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      CONSTRAINT "CK_mechanics_email" CHECK ("email" = lower(trim("email")))
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "mechanics"');
    await queryRunner.query('DROP TYPE "mechanic_status"');
  }
}
