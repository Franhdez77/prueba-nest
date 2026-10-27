import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGithubIdentity1793100006000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN "github_id" varchar(30) UNIQUE');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "github_id"');
  }
}
