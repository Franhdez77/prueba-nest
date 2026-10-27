import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaintenances1793100005000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "maintenance_type" AS ENUM ('PREVENTIVE', 'CORRECTIVE')`);
    await queryRunner.query(`CREATE TYPE "maintenance_status" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')`);
    await queryRunner.query(`CREATE TABLE "maintenances" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "type" "maintenance_type" NOT NULL,
      "description" text NOT NULL,
      "mileage" integer NOT NULL,
      "scheduled_start" timestamptz NOT NULL,
      "scheduled_end" timestamptz NOT NULL,
      "status" "maintenance_status" NOT NULL DEFAULT 'SCHEDULED',
      "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE RESTRICT,
      "mechanic_id" uuid NOT NULL REFERENCES "mechanics"("id") ON DELETE RESTRICT,
      "workshop_id" uuid NOT NULL REFERENCES "workshops"("id") ON DELETE RESTRICT,
      "started_at" timestamptz,
      "work_performed" text,
      "final_cost" numeric(12,2),
      "finished_at" timestamptz,
      "final_mileage" integer,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_maintenances" PRIMARY KEY ("id"),
      CONSTRAINT "CK_maintenance_interval" CHECK ("scheduled_end" > "scheduled_start"),
      CONSTRAINT "CK_maintenance_mileage" CHECK ("mileage" >= 0 AND ("final_mileage" IS NULL OR "final_mileage" >= "mileage")),
      CONSTRAINT "CK_maintenance_cost" CHECK ("final_cost" IS NULL OR "final_cost" >= 0),
      CONSTRAINT "CK_maintenance_started" CHECK ("status" NOT IN ('IN_PROGRESS', 'COMPLETED') OR "started_at" IS NOT NULL),
      CONSTRAINT "CK_maintenance_closing" CHECK ("status" <> 'COMPLETED' OR (
        "work_performed" IS NOT NULL AND length(trim("work_performed")) > 0 AND
        "final_cost" IS NOT NULL AND "finished_at" IS NOT NULL AND "final_mileage" IS NOT NULL AND
        "finished_at" >= "started_at"
      ))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_maintenance_active_vehicle" ON "maintenances" ("vehicle_id") WHERE "status" IN ('SCHEDULED', 'IN_PROGRESS')`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_maintenance_running_mechanic" ON "maintenances" ("mechanic_id") WHERE "status" = 'IN_PROGRESS'`);
    await queryRunner.query(`CREATE INDEX "IX_maintenance_mechanic_schedule" ON "maintenances" ("mechanic_id", "scheduled_start", "scheduled_end") WHERE "status" IN ('SCHEDULED', 'IN_PROGRESS')`);
    await queryRunner.query(`CREATE INDEX "IX_maintenance_vehicle_history" ON "maintenances" ("vehicle_id", "scheduled_start")`);
    await queryRunner.query(`CREATE TABLE "maintenance_audits" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "maintenance_id" uuid NOT NULL REFERENCES "maintenances"("id") ON DELETE RESTRICT,
      "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
      "from_status" "maintenance_status",
      "to_status" "maintenance_status" NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_maintenance_audits" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "IX_maintenance_audits" ON "maintenance_audits" ("maintenance_id", "created_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "maintenance_audits"');
    await queryRunner.query('DROP TABLE "maintenances"');
    await queryRunner.query('DROP TYPE "maintenance_status"');
    await queryRunner.query('DROP TYPE "maintenance_type"');
  }
}
