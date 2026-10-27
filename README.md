# FleetCore

API REST de mantenimiento de flotas con NestJS, TypeScript, JWT, TypeORM y PostgreSQL.

## Estado de implementación

Disponibles: autenticación, autorización por roles, API Key, respuestas y errores
uniformes, Swagger, vehículos, mecánicos y talleres.

Pendientes: mantenimientos e historiales, auditorías, completar el seeder,
dump SQL y evidencias de Postman o Swagger. Nombre y clan del coder: pendientes.

## Ejecución con Docker

Requiere Docker y Docker Compose. No necesitas instalar Node.js ni PostgreSQL
para ejecutar los contenedores.

```bash
# Solo si aún no existe .env:
cp .env.example .env
# Configura DB_PASSWORD, JWT_SECRET y API_KEY en .env.
docker compose up --build -d --wait
docker compose exec api npm run seed:prod
```

Swagger: **http://localhost:3000/docs** (o el puerto `PORT` de `.env`).

Compose crea la base y el usuario definidos en `.env`. La API espera a que
PostgreSQL esté disponible y ejecuta las migraciones antes de iniciar. El seeder
se ejecuta explícitamente con el comando anterior y puede repetirse sin duplicar.

Dentro de los contenedores la API usa `DB_HOST=postgres` y `DB_PORT=5432`;
Compose establece esos valores aunque `.env` tenga `localhost` para ejecución
local. PostgreSQL se comunica por una red interna y no publica su puerto al equipo.
Los datos permanecen en el volumen `postgres_data`.

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f postgres
docker compose down
```

`docker compose down` conserva los datos. No agregues `-v` si quieres mantenerlos.
Las credenciales de inicialización de PostgreSQL se aplican al crear el volumen;
cambiar `DB_PASSWORD` después requiere cambiar también la contraseña en la base.

Si Docker apunta a Desktop y ese motor está apagado, pero tienes Docker Engine
activo, usa `docker --context default compose` en lugar de `docker compose` en
los comandos anteriores. Si otro proceso ocupa el puerto de la API, detenlo o
cambia `PORT` en `.env`.

## Instalación sin Docker

Requisitos de ejecución: Node.js 24, npm y PostgreSQL.

```bash
npm install
cp .env.example .env
# Ajusta .env a tu instalación de PostgreSQL.
npm run migration:run
npm run seed
npm run start:dev
```

La base indicada en `.env` debe existir y el usuario debe tener permisos para crear
sus tablas. Si necesitas crearla, desde una sesión administradora de PostgreSQL:

```sql
CREATE USER fleetcore WITH PASSWORD 'fleetcore_local_example';
CREATE DATABASE fleetcore OWNER fleetcore;
```

La contraseña anterior es un ejemplo local. `.env` está excluido de Git;
`.env.example` contiene claves ficticias. Cambia los valores de ejemplo antes de
usar la aplicación fuera del entorno de pruebas.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production` |
| `PORT` | Puerto HTTP; por defecto 3000 |
| `DB_HOST` | Dirección de PostgreSQL |
| `DB_PORT` | Puerto de PostgreSQL; por defecto 5432 |
| `DB_USERNAME` | Usuario de la base |
| `DB_PASSWORD` | Contraseña de la base |
| `DB_DATABASE` | Nombre de la base |
| `JWT_SECRET` | Secreto de firma JWT de al menos 32 caracteres |
| `API_KEY` | Credencial de integración externa |

La configuración se valida al iniciar. Las tablas se administran con migraciones
TypeORM; `synchronize` está desactivado.

## Seeder y credenciales de prueba

```bash
npm run seed
```

Actualmente crea, sin duplicar ni sobrescribir registros existentes:

- Un administrador: `admin@fleetcore.test`.
- Dos técnicos: `tecnico1@fleetcore.test` y `tecnico2@fleetcore.test`.
- Tres mecánicos: dos activos vinculados a los técnicos y uno inactivo.
- Tres vehículos: dos `AVAILABLE` y uno `INACTIVE`.
- Dos talleres: uno `ACTIVE` y uno `INACTIVE`.

La contraseña de las tres cuentas nuevas es `FleetCore123!`.

**El seeder todavía está incompleto respecto al PDF:** faltan
el cuarto vehículo con mantenimiento `IN_PROGRESS` y un mantenimiento `COMPLETED`.
Se añadirán al implementar esos módulos.

## Autenticación

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/auth/register` | Público; registra `TECHNICIAN` |
| POST | `/auth/login` | Público; devuelve JWT válido por una hora |
| GET | `/auth/me` | JWT; consulta del usuario actual |

Ejemplo de registro:

```json
{
  "name": "Técnico de prueba",
  "email": "tecnico@example.com",
  "password": "UnaClaveSegura123!"
}
```

El login recibe `email` y `password`. Copia `data.accessToken` y envíalo como
`Authorization: Bearer <token>`. Las contraseñas no se devuelven en las respuestas.
El registro público no acepta un campo `role`; el administrador de prueba lo crea
el seeder. Las operaciones administrativas comprueban el rol `ADMIN` mediante
`@Roles()` y `RolesGuard`.

## Integraciones externas

`GET /integrations/status` requiere el encabezado `x-api-key` con el valor de
`API_KEY`. Una clave ausente o incorrecta devuelve `401`. La API Key no permite
acceder a rutas que requieren JWT y un JWT no sustituye la API Key.

## Swagger

Con la aplicación iniciada, abre **http://localhost:3000/docs**.
La especificación está en http://localhost:3000/docs-json. Si cambias `PORT`,
ajusta el puerto de las URLs.

1. Ejecuta `POST /auth/login` con una cuenta registrada o del seeder.
2. Copia `data.accessToken` y abre **Authorize**.
3. En `bearer`, pega solo el token, sin el prefijo `Bearer`.
4. Prueba las operaciones permitidas para el rol. Para registrar vehículos o
   mecánicos, inicia sesión con el administrador.
5. Para integraciones, introduce la `API_KEY` en el campo `api-key` de **Authorize**.

Swagger documenta los datos de entrada, las respuestas y los errores. La UI y la
especificación son públicas; cada operación conserva sus guards.

## Respuestas y errores

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "service": "FleetCore", "status": "ok" },
  "path": "/integrations/status",
  "timestamp": "2026-10-27T12:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Se requiere x-api-key",
  "path": "/integrations/status",
  "timestamp": "2026-10-27T12:00:00.000Z"
}
```

En errores de validación, `message` es una lista. Los códigos HTTP son numéricos.
Los conflictos de unicidad y relaciones devuelven `409`; los datos inválidos,
`400`. Los errores inesperados devuelven `500` con un mensaje genérico.

## Vehículos

Todas las rutas requieren JWT. Solo `ADMIN` puede modificar datos.

| Método | Ruta | Operación |
| --- | --- | --- |
| POST | `/vehicles` | Registrar; estado inicial `AVAILABLE` |
| GET | `/vehicles` | Listar; filtro opcional `?status=AVAILABLE` |
| GET | `/vehicles/plate/:plate` | Consultar por placa |
| GET | `/vehicles/:id` | Consultar por UUID |
| PATCH | `/vehicles/:id` | Actualizar datos; activar con `status: AVAILABLE` |
| DELETE | `/vehicles/:id` | Inactivar y conservar el registro |

```json
{
  "plate": "ABC123",
  "brand": "Toyota",
  "model": "Hilux",
  "year": 2024,
  "mileage": 45000
}
```

La placa se normaliza a mayúsculas y es única. Se validan los tipos de datos,
campos obligatorios y límites de almacenamiento. `IN_MAINTENANCE` se administra
mediante mantenimientos; no se cambia manualmente su estado ni kilometraje durante
una intervención. La inactivación conserva el registro y reserva su placa.

## Mecánicos

Todas las rutas requieren JWT. Solo `ADMIN` puede modificar datos.

| Método | Ruta | Operación |
| --- | --- | --- |
| POST | `/mechanics` | Registrar; estado inicial `ACTIVE` |
| GET | `/mechanics` | Listar; filtro opcional `?status=ACTIVE` o `INACTIVE` |
| GET | `/mechanics/:id` | Consultar por UUID |
| PATCH | `/mechanics/:id` | Actualizar; activar con `status: ACTIVE` |
| DELETE | `/mechanics/:id` | Inactivar conservando el registro |

```json
{
  "name": "Juan Pérez",
  "email": "mecanico@example.com",
  "specialty": "Motores diésel"
}
```

`userId` permite vincular un usuario `TECHNICIAN`; el seeder lo utiliza para los
dos técnicos exigidos. Una cuenta no se vincula a varios mecánicos. No existe una
relación permanente con un taller. El correo se normaliza a minúsculas y es único.
La inactivación conserva el registro.

Las reglas de asignación y horarios quedan pendientes del módulo de mantenimientos.
Se aplicarán las aclaraciones del usuario: varios pendientes sin cruces, fecha y
hora de inicio y fin, un solo mantenimiento en ejecución por mecánico y cancelación
definitiva.

## Talleres

Todas las rutas requieren JWT. Solo `ADMIN` puede registrar y cambiar estados.

| Método | Ruta | Operación |
| --- | --- | --- |
| POST | `/workshops` | Registrar con nombre y dirección; estado inicial `ACTIVE` |
| GET | `/workshops` | Listar únicamente talleres activos |
| GET | `/workshops/:id` | Consultar un taller activo o inactivo por UUID |
| PATCH | `/workshops/:id/status` | Activar o inactivar con `status: ACTIVE` o `INACTIVE` |

```json
{
  "name": "Taller Norte",
  "address": "Calle 50 # 20-30"
}
```

La inactivación conserva el registro. El seeder incluye Taller Norte activo y
Taller Centro inactivo. La validación que impide asignar talleres inexistentes o
inactivos se implementará al crear mantenimientos.

## Comandos y pruebas

```bash
npm run build
npm run start:prod
npm run typecheck
npm test
npm run test:cov
npm run test:e2e
npm run migration:show
```

Las pruebas se compilan con TypeScript y se ejecutan con Jest. Las unitarias no
necesitan PostgreSQL. Las pruebas HTTP usan `fetch` nativo y requieren una base de
pruebas configurada y migraciones aplicadas; eliminan solo sus registros.

Las pruebas Jest no sustituyen las evidencias de Postman o capturas de Swagger
exigidas como entregable. La cobertura se obtiene con `npm run test:cov`; el punto
extra exige superar 40 % y solo cuenta cuando funciona lo obligatorio.
