import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1793100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('ADMIN', 'TECHNICIAN')`,
    );
    await queryRunner.query(`CREATE TABLE "users" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar(100) NOT NULL,
      "email" varchar(254) NOT NULL,
      "password_hash" text NOT NULL,
      "role" "user_role" NOT NULL DEFAULT 'TECHNICIAN',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_users" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_users_email" UNIQUE ("email")
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "user_role"');
  }
}
