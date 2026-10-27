-- FleetCore: database structure and sample data.
-- Import into an empty PostgreSQL database. IDs are generated as 1, 2, 3, ...
-- Test password for the three accounts: FleetCore123!

BEGIN;

-- Tables, relationships, and business constraints.

CREATE TYPE "user_role" AS ENUM ('ADMIN', 'TECHNICIAN');

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "name" varchar(100) NOT NULL,
  "email" varchar(254) NOT NULL,
  "password_hash" text NOT NULL,
  "github_id" varchar(30) UNIQUE,
  "role" "user_role" NOT NULL DEFAULT 'TECHNICIAN',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PK_users" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_users_email" UNIQUE ("email")
);

CREATE TYPE "vehicle_status" AS ENUM ('AVAILABLE', 'IN_MAINTENANCE', 'INACTIVE');

CREATE TABLE "vehicles" (
  "id" SERIAL NOT NULL,
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
);

CREATE TYPE "mechanic_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "mechanics" (
  "id" SERIAL NOT NULL,
  "name" varchar(100) NOT NULL,
  "email" varchar(254) NOT NULL,
  "specialty" varchar(150) NOT NULL,
  "status" "mechanic_status" NOT NULL DEFAULT 'ACTIVE',
  "user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PK_mechanics" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_mechanics_email" UNIQUE ("email"),
  CONSTRAINT "UQ_mechanics_user" UNIQUE ("user_id"),
  CONSTRAINT "FK_mechanics_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "CK_mechanics_email" CHECK ("email" = lower(trim("email")))
);

CREATE TYPE "workshop_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "workshops" (
  "id" SERIAL NOT NULL,
  "name" varchar(100) NOT NULL,
  "address" varchar(255) NOT NULL,
  "status" "workshop_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PK_workshops" PRIMARY KEY ("id")
);

CREATE TYPE "maintenance_type" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

CREATE TYPE "maintenance_status" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "maintenances" (
  "id" SERIAL NOT NULL,
  "type" "maintenance_type" NOT NULL,
  "description" text NOT NULL,
  "mileage" integer NOT NULL,
  "scheduled_start" timestamptz NOT NULL,
  "scheduled_end" timestamptz NOT NULL,
  "status" "maintenance_status" NOT NULL DEFAULT 'SCHEDULED',
  "vehicle_id" integer NOT NULL REFERENCES "vehicles"("id") ON DELETE RESTRICT,
  "mechanic_id" integer NOT NULL REFERENCES "mechanics"("id") ON DELETE RESTRICT,
  "workshop_id" integer NOT NULL REFERENCES "workshops"("id") ON DELETE RESTRICT,
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
);

CREATE UNIQUE INDEX "UQ_maintenance_active_vehicle" ON "maintenances" ("vehicle_id") WHERE "status" IN ('SCHEDULED', 'IN_PROGRESS');

CREATE UNIQUE INDEX "UQ_maintenance_running_mechanic" ON "maintenances" ("mechanic_id") WHERE "status" = 'IN_PROGRESS';

CREATE INDEX "IX_maintenance_mechanic_schedule" ON "maintenances" ("mechanic_id", "scheduled_start", "scheduled_end") WHERE "status" IN ('SCHEDULED', 'IN_PROGRESS');

CREATE INDEX "IX_maintenance_vehicle_history" ON "maintenances" ("vehicle_id", "scheduled_start");

CREATE TABLE "maintenance_audits" (
  "id" SERIAL NOT NULL,
  "maintenance_id" integer NOT NULL REFERENCES "maintenances"("id") ON DELETE RESTRICT,
  "actor_id" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "from_status" "maintenance_status",
  "to_status" "maintenance_status" NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PK_maintenance_audits" PRIMARY KEY ("id")
);

CREATE INDEX "IX_maintenance_audits" ON "maintenance_audits" ("maintenance_id", "created_at");


-- Users: one administrator and two technicians.
INSERT INTO users (name, email, password_hash, role) VALUES
('Administrador', 'admin@fleetcore.test', 'scrypt$e0bda6d2714e7e3c3ffb0cd56227c584$78436d8e49611a324f7a761fe9c12f8f56fa3f7decdb85f3d4cb0e2f02bded0acc834c18d2bf917fd68cef7e073ea47081b4b429e3c45060ff60f96c6906f7f4', 'ADMIN'),
('Técnico uno', 'tecnico1@fleetcore.test', 'scrypt$e0bda6d2714e7e3c3ffb0cd56227c584$78436d8e49611a324f7a761fe9c12f8f56fa3f7decdb85f3d4cb0e2f02bded0acc834c18d2bf917fd68cef7e073ea47081b4b429e3c45060ff60f96c6906f7f4', 'TECHNICIAN'),
('Técnico dos', 'tecnico2@fleetcore.test', 'scrypt$e0bda6d2714e7e3c3ffb0cd56227c584$78436d8e49611a324f7a761fe9c12f8f56fa3f7decdb85f3d4cb0e2f02bded0acc834c18d2bf917fd68cef7e073ea47081b4b429e3c45060ff60f96c6906f7f4', 'TECHNICIAN');


-- Mechanics: two active profiles linked to technician accounts, one inactive profile.
INSERT INTO mechanics (name, email, specialty, status, user_id) VALUES
('Técnico uno', 'tecnico1@fleetcore.test', 'Motor', 'ACTIVE', 2),
('Técnico dos', 'tecnico2@fleetcore.test', 'Frenos', 'ACTIVE', 3),
('Mecánico inactivo', 'inactivo@fleetcore.test', 'Suspensión', 'INACTIVE', NULL);

-- Workshops: one active and one inactive.
INSERT INTO workshops (name, address, status) VALUES
('Taller Norte', 'Calle 50 # 20-30', 'ACTIVE'),
('Taller Centro', 'Carrera 10 # 15-20', 'INACTIVE');

-- Vehicles: two available, one inactive, and one under maintenance.
INSERT INTO vehicles (plate, brand, model, year, mileage, status) VALUES
('ABC123', 'Chevrolet', 'NPR', 2024, 45000, 'AVAILABLE'),
('DEF456', 'Chevrolet', 'NPR', 2024, 45000, 'AVAILABLE'),
('GHI789', 'Chevrolet', 'NPR', 2024, 45000, 'INACTIVE'),
('JKL012', 'Chevrolet', 'NPR', 2024, 60000, 'IN_MAINTENANCE');

-- Maintenance in progress.
INSERT INTO maintenances (
  type, description, mileage, scheduled_start, scheduled_end, status,
  vehicle_id, mechanic_id, workshop_id, started_at
) VALUES (
  'CORRECTIVE', 'Revisión del sistema de frenos',
  60000, '2026-10-27 07:30:00-05', '2026-10-27 09:00:00-05', 'IN_PROGRESS',
  4, 1,
  1, '2026-10-27 07:30:00-05'
);

-- Completed maintenance for vehicle history.
INSERT INTO maintenances (
  type, description, mileage, scheduled_start, scheduled_end, status,
  vehicle_id, mechanic_id, workshop_id, started_at,
  work_performed, final_cost, finished_at, final_mileage
) VALUES (
  'PREVENTIVE', 'Cambio de aceite y filtros',
  44000, '2026-10-20 07:30:00-05', '2026-10-20 09:00:00-05', 'COMPLETED',
  2, 2,
  1, '2026-10-20 07:30:00-05',
  'Aceite y filtros reemplazados', 250000.00, '2026-10-20 09:00:00-05', 45000
);

-- Maintenance audit trail.
INSERT INTO maintenance_audits (maintenance_id, actor_id, from_status, to_status, created_at) VALUES
(1, 1, NULL, 'SCHEDULED', '2026-10-27 07:29:00-05'),
(1, 1, 'SCHEDULED', 'IN_PROGRESS', '2026-10-27 07:30:00-05'),
(2, 1, NULL, 'SCHEDULED', '2026-10-20 07:29:00-05'),
(2, 1, 'SCHEDULED', 'IN_PROGRESS', '2026-10-20 07:30:00-05'),
(2, 1, 'IN_PROGRESS', 'COMPLETED', '2026-10-20 09:00:00-05');

-- Record imported migrations so the application does not recreate these tables.
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR NOT NULL
);

INSERT INTO migrations (timestamp, name) VALUES
(1793100000000, 'CreateUsers1793100000000'),
(1793100001000, 'CreateVehicles1793100001000'),
(1793100002000, 'CreateMechanics1793100002000'),
(1793100004000, 'CreateWorkshops1793100004000'),
(1793100005000, 'CreateMaintenances1793100005000'),
(1793100006000, 'AddGithubIdentity1793100006000');

COMMIT;
