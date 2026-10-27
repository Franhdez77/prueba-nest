import { validateEnvironment } from './environment.js';

const valid = {
  API_KEY: 'test-api-key-with-at-least-thirty-two-characters',
  JWT_SECRET: 'test-secret-at-least-thirty-two-characters',
  DB_HOST: 'localhost',
  DB_USERNAME: 'fleetcore',
  DB_PASSWORD: 'test-password',
  DB_DATABASE: 'fleetcore_test',
};

describe('Environment validation', () => {
  it('convierte los puertos y permite variables externas', () => {
    const env = validateEnvironment({
      ...valid,
      DB_PORT: '55432',
      PORT: '3001',
      PATH: '/bin',
    });
    expect(env.DB_PORT).toBe(55432);
    expect(env.PORT).toBe(3001);
  });

  it('rechaza credenciales ausentes y puertos inválidos sin revelar valores', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        DB_PASSWORD: '',
        DB_PORT: 'secret-invalid-port',
      }),
    ).toThrow('Variables de entorno inválidas: DB_PORT, DB_PASSWORD');
  });
});

it('requires complete OAuth settings and rejects insecure remote callbacks', () => {
  expect(() => validateEnvironment({ ...valid, GITHUB_CLIENT_ID: 'client' })).toThrow('GITHUB_CLIENT_SECRET');
  expect(() => validateEnvironment({ ...valid, GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', GITHUB_CALLBACK_URL: 'http://example.com/callback' })).toThrow('GITHUB_CALLBACK_URL');
  const env = validateEnvironment({ ...valid, GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback' });
  expect(env.GITHUB_CLIENT_ID).toBe('client');
});
