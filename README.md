# FleetCore

API REST de mantenimiento de flotas con NestJS, TypeScript, JWT, TypeORM y PostgreSQL.

## Estado de implementación

Disponibles: autenticación, autorización por roles, API Key, respuestas y errores
uniformes, Swagger, vehículos, mecánicos, talleres, mantenimientos, historiales
y auditoría de creación y cambios de estado.

Pendientes de entrega: dump SQL, evidencias de Postman o Swagger y publicación
del repositorio actualizado. Nombre y clan del coder: pendientes.

La matriz de criterios y resultados está en [Revisión final](docs/revision-final.md).

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
- Cuatro vehículos: dos `AVAILABLE`, uno `INACTIVE` y uno `IN_MAINTENANCE`.
- Dos talleres: uno `ACTIVE` y uno `INACTIVE`.
- Un mantenimiento `IN_PROGRESS` para el cuarto vehículo.
- Un mantenimiento `COMPLETED` con datos de cierre e historial.
- Auditoría de los estados de esos mantenimientos.

La contraseña de las tres cuentas nuevas es `FleetCore123!`.

## Autenticación

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/auth/register` | Público; registra `TECHNICIAN` |
| POST | `/auth/users` | JWT y ADMIN; registra cuentas ADMIN o TECHNICIAN |
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
El registro público no acepta un campo `role`; el primer administrador de prueba
lo crea el seeder. Después, un administrador puede registrar cuentas de cualquiera
de los dos roles con `POST /auth/users`, enviando los campos del registro y `role`. Las operaciones administrativas comprueban el rol `ADMIN` mediante
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

Los mantenimientos usan el vínculo con el usuario técnico para limitar sus
consultas y cambios a sus asignaciones. Los horarios se validan entre todos los
talleres.

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
Taller Centro inactivo. No se pueden programar ni iniciar mantenimientos con un taller inexistente o
inactivo.

## Mantenimientos e historial

Todas las rutas requieren JWT. `ADMIN` programa y consulta todos los mantenimientos.
`TECHNICIAN` consulta y actualiza solo los que tiene asignados mediante su mecánico.
Las respuestas incluyen los datos del vehículo, mecánico y taller.

| Método | Ruta | Operación |
| --- | --- | --- |
| POST | `/maintenances` | Programar mantenimiento (ADMIN) |
| GET | `/maintenances` | Consultar con filtros `status`, `type`, `active`, `vehicleId`, `mechanicId` |
| GET | `/maintenances/mine` | Consultar asignaciones del técnico autenticado |
| GET | `/maintenances/:id` | Consultar una intervención |
| PATCH | `/maintenances/:id/status` | Cambiar estado (ADMIN o técnico asignado) |
| GET | `/maintenances/vehicle/:vehicleId/history` | Historial del vehículo, en todos sus estados |
| GET | `/maintenances/mechanic/:mechanicId` | Intervenciones del mecánico |
| GET | `/maintenances/:id/audits` | Consultar creación y cambios de estado (ADMIN) |

Ejemplo para programar (sustituye los UUID por recursos activos):

```json
{
  "type": "PREVENTIVE",
  "description": "Cambio de aceite y filtros",
  "mileage": 45000,
  "scheduledStart": "2026-11-01T07:30:00-05:00",
  "scheduledEnd": "2026-11-01T09:00:00-05:00",
  "vehicleId": "UUID_DEL_VEHICULO",
  "mechanicId": "UUID_DEL_MECANICO",
  "workshopId": "UUID_DEL_TALLER"
}
```

Tipos: `PREVENTIVE` y `CORRECTIVE`. El estado inicial es `SCHEDULED`.
Las fechas incluyen zona horaria y la hora de fin debe ser posterior al inicio.
El mecánico puede tener varios pendientes sin cruces, incluso en distintos
talleres. Un horario que termina a las 09:00 permite otro que comienza a las 09:00.
Un vehículo solo puede tener un mantenimiento `SCHEDULED` o `IN_PROGRESS`.
El kilometraje inicial no puede ser inferior al actual del vehículo.

Transiciones permitidas:

- `SCHEDULED` → `IN_PROGRESS` o `CANCELLED`.
- `IN_PROGRESS` → `COMPLETED`.
- `COMPLETED` y `CANCELLED` son definitivos.

No se permite cancelar una intervención en proceso. Al iniciar, el vehículo pasa
a `IN_MAINTENANCE`. Cada mecánico solo puede ejecutar una intervención a la vez,
aunque tenga otras programadas. La cancelación de un pendiente conserva el estado
del vehículo y libera la reserva del horario y del vehículo.

Para iniciar, envía `{"status":"IN_PROGRESS"}`. Para completar:

```json
{
  "status": "COMPLETED",
  "workPerformed": "Aceite y filtros reemplazados",
  "finalCost": 250000,
  "finishedAt": "2026-11-01T09:00:00-05:00",
  "finalMileage": 45100
}
```

Los cuatro campos de cierre son obligatorios; la fecha final no puede ser anterior
al inicio real y el kilometraje no puede retroceder. Al completar, el vehículo
queda `AVAILABLE` con el kilometraje final. El costo admite dos decimales y se
devuelve como cadena decimal para conservar precisión.

Las reservas y transiciones usan transacciones y bloqueos de filas; PostgreSQL
refuerza la unicidad del mantenimiento activo por vehículo y del que está en
proceso por mecánico. La auditoría se guarda dentro de la misma transacción.
Los conflictos devuelven `409` y los datos inválidos, `400`.

El seeder puede repetirse: no reabre ni sobrescribe mantenimientos ya existentes.
El técnico uno tiene el mantenimiento de ejemplo en proceso; usa el técnico dos
u otro mecánico activo para probar una ejecución adicional.

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
exigidas como entregable. La cobertura se obtiene con `npm run test:cov`.

### Cobertura de pruebas unitarias

```bash
npm run test:cov
```

La suite tiene 101 pruebas unitarias y se ejecuta sin PostgreSQL. Incluye
registro y login con hashing y JWT reales, guards de autenticación, roles y API
Key, permisos por asignación, reservas, estados, cierre, auditorías y protección
de datos de vehículos y mecánicos. La persistencia se sustituye por dobles de
prueba; la concurrencia real y las transacciones de PostgreSQL se comprueban en
la suite HTTP separada.

Última medición:

| Métrica | Cobertura |
| --- | --- |
| Sentencias | 61,33 % |
| Ramas | 43,01 % |
| Funciones | 55,08 % |
| Líneas | 66,95 % |

Jest exige al menos 41 % en cada métrica y falla si se incumple ese umbral.
El alcance incluye controladores, guards y servicios; las exclusiones de archivos
de módulos, entidades, DTO, Swagger, migraciones y seeder se especifican en
`jest.config.cjs`. Las pruebas HTTP no se suman a estas cifras.

El informe HTML se genera en `coverage/lcov-report/index.html` y el resumen
legible por herramientas en `coverage/coverage-summary.json`. Ambos se regeneran
con el comando y están excluidos de Git.

El extra de Jest requiere cobertura superior al 40 % y solo se califica cuando
funcionan los requisitos obligatorios.
