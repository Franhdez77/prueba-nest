import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import type { Environment } from '../config/environment.js';

export function databaseOptions(
  env: Omit<Environment, 'JWT_SECRET' | 'API_KEY'>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    entities: [fileURLToPath(new URL('../**/*.entity.js', import.meta.url))],
    migrations: [fileURLToPath(new URL('./migrations/*.js', import.meta.url))],
    synchronize: false,
    migrationsRun: false,
  };
}
