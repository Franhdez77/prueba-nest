export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  JWT_SECRET: string;
  API_KEY: string;
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const invalid: string[] = [];
  const text = (field: string) => {
    const value = config[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      invalid.push(field);
      return '';
    }
    return value;
  };
  const port = (field: string, fallback: number) => {
    const raw = config[field] ?? fallback;
    const value = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < 1 || value > 65535) invalid.push(field);
    return value;
  };
  const nodeEnv = config.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(String(nodeEnv))) invalid.push('NODE_ENV');
  const env: Environment = {
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    PORT: port('PORT', 3000),
    DB_HOST: text('DB_HOST'),
    DB_PORT: port('DB_PORT', 5432),
    DB_USERNAME: text('DB_USERNAME'),
    DB_PASSWORD: text('DB_PASSWORD'),
    DB_DATABASE: text('DB_DATABASE'),
    JWT_SECRET: text('JWT_SECRET'),
    API_KEY: text('API_KEY'),
  };
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) invalid.push('JWT_SECRET');
  // No incluye valores para evitar exponer contraseñas en los errores de arranque.
  if (invalid.length) throw new Error(`Variables de entorno inválidas: ${invalid.join(', ')}`);
  return env;
}
