import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { User } from '../src/users/user.entity.js';
import { Role } from '../src/users/role.enum.js';
import { hashPassword } from '../src/auth/password.js';
import request from './http-request.js';

// Stub only the external provider; exercise real guards, cookies and persistence.
describe('GitHub account linking (HTTP)', () => {
  let app: INestApplication;
  let db: DataSource;
  let jwt: JwtService;
  let first: User;
  let second: User;
  let firstToken: string;
  let secondToken: string;
  const originalFetch = globalThis.fetch;
  const githubId = String(100000000 + Math.floor(Math.random() * 100000000));
  let providerId = Number(githubId);
  const suffix = randomBytes(8).toString('hex');
  const password = 'TestPassword123!';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
    db = app.get(DataSource); jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    config.set('GITHUB_CLIENT_ID', 'http-test-client');
    config.set('GITHUB_CLIENT_SECRET', 'http-test-secret');
    config.set('GITHUB_CALLBACK_URL', 'http://localhost:3000/auth/github/callback');
    const repo = db.getRepository(User);
    const passwordHash = await hashPassword(password);
    first = await repo.save(repo.create({ name: 'OAuth first', email: `oauth-first-${suffix}@example.com`, passwordHash, role: Role.TECHNICIAN }));
    second = await repo.save(repo.create({ name: 'OAuth second', email: `oauth-second-${suffix}@example.com`, passwordHash, role: Role.ADMIN }));
    firstToken = await jwt.signAsync({ sub: String(first.id), role: first.role });
    secondToken = await jwt.signAsync({ sub: String(second.id), role: second.role });
    globalThis.fetch = jest.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') return new Response(JSON.stringify({ access_token: 'test-provider-token' }));
      if (url === 'https://api.github.com/user') return new Response(JSON.stringify({ id: providerId, email: first.email, role: 'ADMIN' }));
      return originalFetch(input, init);
    });
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (db && first) await db.getRepository(User).delete(first.id);
    if (db && second) await db.getRepository(User).delete(second.id);
    await app?.close();
  });

  async function link(token: string) {
    const response = await request(app.getHttpServer()).post('/auth/github/link').set('Authorization', `Bearer ${token}`).expect(201);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const state = new URL(response.body.data.authorizationUrl).searchParams.get('state');
    return { cookie, state };
  }
  function callback(session: { cookie: string; state: string | null }) {
    return request(app.getHttpServer()).get(`/auth/github/callback?code=provider-code&state=${session.state}`)
      .set('Cookie', session.cookie);
  }

  it('requires JWT before starting account linking', async () => {
    await request(app.getHttpServer()).post('/auth/github/link').expect(401);
  });

  it('rejects unknown identities without creating a user or matching an existing email', async () => {
    const before = await db.getRepository(User).count();
    const state = 'test-login-state';
    const cookie = await jwt.signAsync({ state, verifier: 'test-verifier' }, { audience: 'github-oauth', expiresIn: '10m' });
    await callback({ state, cookie: `fleetcore_github_oauth=${cookie}` }).expect(401);
    expect(await db.getRepository(User).count()).toBe(before);
    expect(await db.getRepository(User).findOneBy({ githubId })).toBeNull();
  });

  it('links the authenticated account, preserves its password and role, and issues a usable JWT', async () => {
    const session = await link(firstToken);
    const result = await callback(session).expect(200);
    expect(result.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
    expect(result.body.data.user).toMatchObject({ id: first.id, role: 'TECHNICIAN', email: first.email });
    expect(result.body.data.user).not.toHaveProperty('githubId');
    const profile = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${result.body.data.accessToken}`).expect(200);
    expect(profile.body.data.id).toBe(first.id);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: first.email, password }).expect(200);
    expect(login.body.data.user.id).toBe(first.id);
  });

  it('allows subsequent GitHub sign-in to the same linked account', async () => {
    const state = 'linked-login-state';
    const cookie = await jwt.signAsync({ state, verifier: 'test-verifier' }, { audience: 'github-oauth', expiresIn: '10m' });
    const result = await callback({ state, cookie: `fleetcore_github_oauth=${cookie}` }).expect(200);
    expect(result.body.data.user.id).toBe(first.id);
  });

  it('prevents attaching one GitHub identity to another FleetCore account', async () => {
    await callback(await link(secondToken)).expect(409);
    expect((await db.getRepository(User).findOneByOrFail({ githubId })).id).toBe(first.id);
  });

  it('prevents replacing a previously linked GitHub identity', async () => {
    providerId = Number(githubId) + 1;
    await callback(await link(firstToken)).expect(409);
    expect((await db.getRepository(User).findOneByOrFail({ githubId })).id).toBe(first.id);
  });
});
