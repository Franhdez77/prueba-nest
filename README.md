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
