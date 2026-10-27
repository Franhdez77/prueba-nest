# FleetCore

API REST de mantenimiento de flotas con NestJS, TypeScript, JWT, TypeORM y PostgreSQL.

## Ejecución

```bash
npm install
cp .env.example .env
# Configura la conexión a PostgreSQL en .env.
npm run migration:run
npm run start:dev
```

Incluye registro, login JWT, guards por roles, integración con API Key y respuestas uniformes.

## Swagger

Documentación en http://localhost:3000/docs. Permite probar la API con JWT y API Key.

## Vehículos

Consultas por ID o placa y listado protegido. El administrador puede registrar, actualizar e inactivar vehículos sin eliminarlos.

## Mecánicos

Gestión de mecánicos con activación e inactivación y vínculo opcional a usuarios técnicos.
