# FleetCore

REST API for managing vehicle fleet maintenance, built with NestJS, TypeScript,
JWT, TypeORM, and PostgreSQL. It includes role-based access, external API Key
authentication, vehicle and mechanic management, workshops, maintenance scheduling,
status transitions, vehicle history, and maintenance audit records.

## Coder information

- **Name:** Francisco Hernandez
- **Clan:** Node/Nest AN
- **Repository:** https://github.com/Franhdez77/prueba-nest

## 1. Get the project

```bash
git clone https://github.com/Franhdez77/prueba-nest.git
cd prueba-nest
```

If you already have a local copy, run the following commands from its root folder.
Choose either Docker or local installation.

## 2. Configure environment variables

Create the environment file if it does not exist:

```bash
cp .env.example .env
```

Edit `.env` before starting the application:

| Variable | Purpose | Example/default |
| --- | --- | --- |
| `NODE_ENV` | Application environment | `development` |
| `PORT` | API port on the host | `3000` |
| `DB_HOST` | PostgreSQL host for local execution | `localhost` |
| `DB_PORT` | PostgreSQL port for local execution | `5432` |
| `DB_USERNAME` | Database user | `fleetcore` |
| `DB_PASSWORD` | Database password | Match your PostgreSQL credentials |
| `DB_DATABASE` | Database name | `fleetcore` |
| `JWT_SECRET` | JWT signing secret, at least 32 characters | Replace the example value |
| `API_KEY` | External integration credential | Replace the example value |

`.env.example` contains fictitious values. `.env` is excluded from Git and from
the Docker build context. The application validates its environment on startup.

## 3. Start with Docker

**Requirements:** Docker Engine or Docker Desktop, and Docker Compose.
Node.js and PostgreSQL do not need to be installed on the host for this option.

```bash
docker compose up --build -d --wait
```

Compose creates PostgreSQL using `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE`.
The API waits until PostgreSQL is healthy, runs the database migrations, and
starts automatically. You do not need to run migrations manually before Docker.

Inside the containers, Compose sets `DB_HOST=postgres`, `DB_PORT=5432`, and
`PORT=3000`. The host's `PORT` value controls the published API port.
PostgreSQL uses an internal network and a persistent volume; its port is not
published to the host.

Load the sample data after startup:

```bash
docker compose exec api npm run seed:prod
```

Useful commands:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f postgres
docker compose down
```

`docker compose down` preserves the database volume. Adding `-v` deletes its data.
Changing `DB_PASSWORD` after the volume has been initialized also requires updating
the password in PostgreSQL; changing the environment file alone does not change it.

If Docker Desktop is unavailable but the system Docker Engine is running, replace
`docker compose` with `docker --context default compose` in these commands.
If port 3000 is occupied, set `PORT=3001` in `.env`, or use a temporary override:

```bash
PORT=3001 docker --context default compose up --build -d --wait
```

With that override, Swagger is available at **http://localhost:3001/docs**.

## 4. Start without Docker

**Requirements:** Node.js 24, npm, and a running PostgreSQL instance.

Install dependencies:

```bash
npm ci
```

Create the database and user if necessary. Run the following SQL from an
administrator session connected to your local PostgreSQL instance:

```sql
CREATE USER fleetcore WITH PASSWORD 'fleetcore_local_example';
CREATE DATABASE fleetcore OWNER fleetcore;
```

Use the same database credentials in `.env`. The password above is only a local
example. The database must exist before running migrations.

Apply migrations, load sample data, and start the development server:

```bash
npm run migration:run
npm run seed
npm run start:dev
```

For a compiled local build:

```bash
npm run build
npm run start:prod
```

TypeORM's `synchronize` option is disabled. Apply migrations before starting the
application locally. For PostgreSQL connection errors, check that the server is
running on `DB_HOST:DB_PORT` and that the credentials match `.env`.

## 5. Seeder and test credentials

Run the seeder with one command:

```bash
# Local execution:
npm run seed

# Docker execution:
docker compose exec api npm run seed:prod
```

Running it again does not duplicate records, overwrite existing data, or reopen
finished maintenance records.

| Role | Email | Password |
| --- | --- | --- |
| `ADMIN` | `admin@fleetcore.test` | `FleetCore123!` |
| `TECHNICIAN` | `tecnico1@fleetcore.test` | `FleetCore123!` |
| `TECHNICIAN` | `tecnico2@fleetcore.test` | `FleetCore123!` |

These credentials apply to accounts newly created by the seeder and are intended
for testing. Existing accounts keep their existing passwords.

The initial dataset contains:

- One administrator and two technicians.
- Three mechanics: two active profiles linked to the technicians, and one inactive
  profile without a login account.
- Two workshops: one active and one inactive.
- Four vehicles: two `AVAILABLE`, one `IN_MAINTENANCE`, and one `INACTIVE`.
- One `IN_PROGRESS` maintenance record associated with the vehicle under maintenance.
- One `COMPLETED` maintenance record with closing information and vehicle history.
- Audit entries for the sample maintenance records.

The first technician already has an intervention in progress. Use the second
technician or another active mechanic to test an additional execution.

## 6. Swagger and API usage

Default API URL: **http://localhost:3000**.

- **Swagger UI:** http://localhost:3000/docs
- **OpenAPI JSON:** http://localhost:3000/docs-json

Replace port 3000 with your configured host port when necessary.

### Sign in

In Swagger, open `POST /auth/login`, select **Try it out**, and submit:

```json
{
  "email": "admin@fleetcore.test",
  "password": "FleetCore123!"
}
```

Copy `data.accessToken` from the response. Select **Authorize** and paste only the
token into the `bearer` field; do not include the `Bearer` prefix. You can then
execute operations allowed for that account's role.

For direct HTTP clients, send `Authorization: Bearer <token>`.
JWTs expire after one hour. Passwords and password hashes are never included in
API responses.

### Register accounts and link mechanics

`POST /auth/register` is public and creates a `TECHNICIAN` account:

```json
{
  "name": "Example Technician",
  "email": "technician@example.com",
  "password": "ExamplePassword123!"
}
```

The public endpoint does not accept `role`. An authenticated administrator can use
`POST /auth/users` with the same fields plus `role: ADMIN` or `role: TECHNICIAN`.
The seeder creates the initial administrator account.

A technician's user account stores login credentials. Its mechanic profile stores
work-related information. The optional, one-to-one link is `Mechanic.userId`.
Creating an account does not automatically create a mechanic profile: an
administrator links them through `POST /mechanics` or `PATCH /mechanics/:id`.
An inactive mechanic cannot receive a new assignment or start a scheduled job;
the linked account can still sign in, view its history, and finish work already
in progress.

### Test the main workflow

1. Sign in as the administrator.
2. Use `/vehicles`, `/mechanics`, and `/workshops` to select active resources or
   register new ones. A mechanic must have a linked technician account if that
   technician will use the API to manage the assignment.
3. Create a maintenance record with `POST /maintenances`.
4. Sign in as the assigned technician, authorize its JWT, and open
   `GET /maintenances/mine`.
5. Start the intervention using `PATCH /maintenances/:id/status` with
   `{"status":"IN_PROGRESS"}`. The vehicle becomes `IN_MAINTENANCE`.
6. Complete the intervention with all four closing fields. The vehicle becomes
   `AVAILABLE` and receives the final mileage.
7. Check the vehicle history and, as an administrator, the maintenance audit trail.

Example scheduling request; replace the ID placeholders with existing resource IDs:

```json
{
  "type": "PREVENTIVE",
  "description": "Replace engine oil and filters",
  "mileage": 45000,
  "scheduledStart": "2026-11-01T07:30:00-05:00",
  "scheduledEnd": "2026-11-01T09:00:00-05:00",
  "vehicleId": "VEHICLE_UUID",
  "mechanicId": "MECHANIC_UUID",
  "workshopId": "WORKSHOP_UUID"
}
```

Example closing request; use an actual finish time at or after the real start time:

```json
{
  "status": "COMPLETED",
  "workPerformed": "Engine oil and filters replaced",
  "finalCost": 250000,
  "finishedAt": "2026-11-01T09:00:00-05:00",
  "finalMileage": 45100
}
```

### Business rules

- Maintenance types are `PREVENTIVE` and `CORRECTIVE`; initial status is `SCHEDULED`.
- A vehicle can have only one active maintenance record (`SCHEDULED` or `IN_PROGRESS`).
- A mechanic can have multiple scheduled jobs without overlapping time intervals,
  regardless of the workshop. A job ending at 09:00 allows another to start at 09:00.
- Each mechanic can have only one job in progress.
- Scheduling requires available vehicles, active mechanics, and active workshops.
- Mileage cannot be lower than the vehicle's current mileage when scheduling or closing.
- `SCHEDULED` can become `IN_PROGRESS` or `CANCELLED`.
- `IN_PROGRESS` can become `COMPLETED`; cancellation is not allowed once work starts.
- `COMPLETED` and `CANCELLED` are final states.
- Completion requires work performed, final cost, finish time, and final mileage.
- Costs accept up to two decimal places and are returned as decimal strings.
- Deactivation preserves records and their maintenance history.

### External integration

`GET /integrations/status` requires the `x-api-key` header. In Swagger's
**Authorize** dialog, enter your `.env` value for `API_KEY` in the `api-key` field.
A JWT does not replace this key, and the key does not grant access to JWT-protected
business endpoints.

### Endpoint reference

All routes below require JWT except public registration/login and the integration
route, which uses API Key. Only administrators can modify vehicles, mechanics,
and workshops or schedule maintenance.

| Resource | Endpoints |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/users` (ADMIN) |
| Vehicles | `POST /vehicles`, `GET /vehicles`, `GET /vehicles/:id`, `GET /vehicles/plate/:plate`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id` |
| Mechanics | `POST /mechanics`, `GET /mechanics`, `GET /mechanics/:id`, `PATCH /mechanics/:id`, `DELETE /mechanics/:id` |
| Workshops | `POST /workshops`, `GET /workshops`, `GET /workshops/:id`, `PATCH /workshops/:id/status` |
| Maintenance | `POST /maintenances`, `GET /maintenances`, `GET /maintenances/mine` (TECHNICIAN), `GET /maintenances/:id`, `PATCH /maintenances/:id/status` |
| History | `GET /maintenances/vehicle/:vehicleId/history`, `GET /maintenances/mechanic/:mechanicId` |
| Audit | `GET /maintenances/:id/audits` (ADMIN) |
| Integration | `GET /integrations/status` (API Key) |

Vehicle and mechanic DELETE operations deactivate records. Workshops are
activated or deactivated using their status endpoint. The workshop list returns
only active workshops. Maintenance queries support `status`, `type`, `vehicleId`,
`mechanicId`, and `active=true` or `active=false`.
Technicians can only read or update their own maintenance assignments.

## 7. Tests and coverage

With Node.js 24 and dependencies installed locally:

```bash
npm run typecheck
npm test
npm run test:cov
```

The 101 unit tests run without PostgreSQL. The latest measured coverage is:

| Metric | Coverage |
| --- | ---: |
| Statements | 61.33% |
| Branches | 43.01% |
| Functions | 55.08% |
| Lines | 66.95% |

Jest enforces at least 41% in all four metrics. The HTML report is generated at
`coverage/lcov-report/index.html`, with a JSON summary at
`coverage/coverage-summary.json`. Coverage exclusions are declared in
`jest.config.cjs`; HTTP tests are not included in these unit coverage figures.

To run the 39 HTTP tests, configure a separate PostgreSQL test database in the
environment and apply migrations before running:

```bash
npm run migration:run
npm run test:e2e
```

These tests use native HTTP requests and remove only their own fixtures.
The Docker runtime image contains production dependencies only; run Jest from
the local development installation. Docker's PostgreSQL port is internal, so
local HTTP tests require a separately reachable test database.

## 8. Delivery checklist

- Coder name and clan: included above.
- Installation, environment, seeder, test credentials, and Swagger URL: documented.
- `.env.example`: included.
- Docker setup and Jest coverage above 40%: implemented and tested.
- Database SQL dump for Moodle: pending.
- Postman collection or Swagger screenshots: pending; Jest results do not replace them.
- Publish the latest commits to the public repository: pending.

The requirements review matrix is available in [docs/revision-final.md](docs/revision-final.md).
OAuth 2.0 is an optional extra and is not implemented.
