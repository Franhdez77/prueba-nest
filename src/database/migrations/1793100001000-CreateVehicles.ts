import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehicles1793100001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "vehicle_status" AS ENUM ('AVAILABLE', 'IN_MAINTENANCE', 'INACTIVE')`,
    );
    await queryRunner.query(`CREATE TABLE "vehicles" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "plate" varchar(20) NOT NULL,
      "brand" varchar(100) NOT NULL,
      "model" varchar(100) NOT NULL,
      "year" integer NOT NULL,
      "mileage" integer NOT NULL,
      "status" "vehicle_status" NOT NULL DEFAULT 'AVAILABLE',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_vehicles_plate" UNIQUE ("plate"),
      CONSTRAINT "CK_vehicles_mileage" CHECK ("mileage" >= 0),
      CONSTRAINT "CK_vehicles_plate" CHECK ("plate" = upper(trim("plate")))
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "vehicles"');
    await queryRunner.query('DROP TYPE "vehicle_status"');
  }
}
