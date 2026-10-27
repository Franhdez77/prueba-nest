import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException } from '@nestjs/common';
import { GithubOAuthService } from './github-oauth.service.js';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';
import { Role } from '../users/role.enum.js';

const jwt = new JwtService({ secret: 'oauth-test-secret-at-least-thirty-two-characters', signOptions: { expiresIn: '1h' } });
const settings = { GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback' };

describe('GitHub OAuth', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn<typeof fetch>();
  const users = { findByGithubId: jest.fn<UsersService['findByGithubId']>(), create: jest.fn<UsersService['create']>(), linkGithub: jest.fn<UsersService['linkGithub']>() };
  let service: GithubOAuthService;
  const stored = Object.assign(new User(), { id: 4, name: 'GitHub User', email: 'github@example.com', role: Role.TECHNICIAN });
  const reply = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  async function start(userId?: number) {
    const result = await service.start(userId);
    return { ...result, state: new URL(result.url).searchParams.get('state')! };
  }
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    users.findByGithubId.mockReset().mockResolvedValue(null);
    users.create.mockReset().mockResolvedValue(stored);
    users.linkGithub.mockReset().mockResolvedValue(stored);
    service = new GithubOAuthService(new ConfigService(settings), jwt, users as unknown as UsersService,
      new AuthService(users as unknown as UsersService, jwt));
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('creates a PKCE authorization URL and a short-lived cookie that cannot authenticate to the API', async () => {
    const result = await start();
    const url = new URL(result.url);
    expect(url.origin).toBe('https://github.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toHaveLength(43);
    expect(result.secure).toBe(false);
    const payload = await jwt.verifyAsync(result.cookie, { audience: 'github-oauth' });
    expect(payload.exp - payload.iat).toBe(600);
    expect(payload.sub).toBeUndefined();
  });

  it('rejects missing configuration', async () => {
    const disabled = new GithubOAuthService(new ConfigService({}), jwt, users as unknown as UsersService, {} as AuthService);
    await expect(disabled.start()).rejects.toMatchObject({ status: 503 });
  });

  it('rejects missing, mismatched, forged and expired state before contacting GitHub', async () => {
    const result = await start();
    const expired = await jwt.signAsync({ state: result.state, verifier: 'verifier' }, { audience: 'github-oauth', expiresIn: -1 });
    for (const [code, state, cookie] of [[undefined, result.state, result.cookie], ['code', 'wrong', result.cookie],
      ['code', result.state, 'forged'], ['code', result.state, expired], ['code', result.state, undefined]]) {
      await expect(service.callback(code, state, cookie)).rejects.toMatchObject({ status: 401 });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown GitHub identity without creating or linking any account', async () => {
    const result = await start();
    reply({ access_token: 'provider-token' }); reply({ id: 123, email: stored.email, role: 'ADMIN' });
    await expect(service.callback('code', result.state, result.cookie)).rejects.toMatchObject({ status: 401 });
    expect(users.create).not.toHaveBeenCalled();
    expect(users.linkGithub).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('links only the account in signed state and returns its valid JWT', async () => {
    const result = await start(stored.id);
    reply({ access_token: 'provider-token' }); reply({ id: 123, role: 'ADMIN' });
    const login = await service.callback('code', result.state, result.cookie);
    expect(users.linkGithub).toHaveBeenCalledWith(stored.id, '123');
    expect(users.create).not.toHaveBeenCalled();
    expect(await jwt.verifyAsync(login.accessToken)).toMatchObject({ sub: '4', role: 'TECHNICIAN' });
    expect(login.user).not.toHaveProperty('passwordHash');
    expect(login.user).not.toHaveProperty('githubId');
    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('code_verifier')).toBeTruthy();
  });

  it('reuses the linked account and preserves its current role', async () => {
    users.findByGithubId.mockResolvedValue(Object.assign(new User(), stored, { role: Role.ADMIN }));
    const result = await start();
    reply({ access_token: 'token' }); reply({ id: 123 });
    const login = await service.callback('code', result.state, result.cookie);
    expect(login.user.role).toBe(Role.ADMIN);
    expect(users.create).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves link conflicts instead of creating or replacing users', async () => {
    users.linkGithub.mockRejectedValue(new ConflictException('Already linked'));
    const result = await start(stored.id);
    reply({ access_token: 'token' }); reply({ id: 123 });
    await expect(service.callback('code', result.state, result.cookie)).rejects.toMatchObject({ status: 409 });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rejects denied access and invalid provider identities', async () => {
    for (const scenario of ['denied', 'identity']) {
      const result = await start();
      reply(scenario === 'denied' ? { error: 'access_denied' } : { access_token: 'token' });
      if (scenario !== 'denied') reply({ id: '123' });
      await expect(service.callback('code', result.state, result.cookie)).rejects.toMatchObject({ status: 401 });
    }
    expect(users.create).not.toHaveBeenCalled();
    expect(users.linkGithub).not.toHaveBeenCalled();
  });

  it('handles provider network errors, HTTP failures and invalid JSON', async () => {
    for (const scenario of ['network', 'http', 'json']) {
      const result = await start();
      if (scenario === 'network') fetchMock.mockRejectedValueOnce(new Error('timeout'));
      if (scenario === 'http') reply({}, 401);
      if (scenario === 'json') fetchMock.mockResolvedValueOnce(new Response('invalid-json'));
      await expect(service.callback('code', result.state, result.cookie)).rejects.toMatchObject({ status: scenario === 'http' ? 401 : 503 });
    }
  });
});
