import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class GithubOAuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private settings() {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET');
    const callback = this.config.get<string>('GITHUB_CALLBACK_URL');
    if (!clientId || !clientSecret || !callback) {
      throw new ServiceUnavailableException('GitHub sign-in is not configured');
    }
    return { clientId, clientSecret, callback };
  }

  async start(linkUserId?: number) {
    const { clientId, callback } = this.settings();
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    // A separate audience prevents this temporary cookie from being an API JWT.
    const cookie = await this.jwt.signAsync({ state, verifier, ...(linkUserId === undefined ? {} : { linkUserId }) }, { audience: 'github-oauth', expiresIn: '10m' });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: clientId, redirect_uri: callback, scope: 'read:user', state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { url: url.toString(), cookie, secure: callback.startsWith('https:') };
  }

  private async githubJson(url: string, options: RequestInit): Promise<unknown> {
    let response: globalThis.Response;
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000), redirect: 'error' });
    } catch {
      throw new ServiceUnavailableException('GitHub is temporarily unavailable');
    }
    if (!response.ok) throw new UnauthorizedException('GitHub authentication failed');
    try {
      const data: unknown = await response.json();
      if (data === null || typeof data !== 'object') throw new Error('Invalid JSON shape');
      return data;
    }
    catch { throw new ServiceUnavailableException('Invalid response from GitHub'); }
  }

  async callback(code: unknown, state: unknown, cookie?: string) {
    const settings = this.settings();
    if (typeof code !== 'string' || !code || code.length > 512 ||
        typeof state !== 'string' || !state || !cookie) {
      throw new UnauthorizedException('Invalid GitHub authorization response');
    }
    let session: { state: string; verifier: string; linkUserId?: number };
    try {
      session = await this.jwt.verifyAsync(cookie, { audience: 'github-oauth', algorithms: ['HS256'] });
      if (session.state !== state || typeof session.verifier !== 'string' ||
          (session.linkUserId !== undefined && (!Number.isSafeInteger(session.linkUserId) || session.linkUserId < 1))) throw new Error('Invalid state');
    } catch { throw new UnauthorizedException('Invalid or expired GitHub state'); }

    const token = await this.githubJson('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret,
        redirect_uri: settings.callback, code, code_verifier: session.verifier }),
    }) as { access_token?: unknown };
    if (typeof token.access_token !== 'string' || !token.access_token) {
      throw new UnauthorizedException('GitHub authorization was denied');
    }
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'FleetCore' };
    const profile = await this.githubJson('https://api.github.com/user', { headers }) as { id?: unknown; name?: unknown; login?: unknown };
    if (!Number.isSafeInteger(profile.id) || Number(profile.id) <= 0) {
      throw new UnauthorizedException('Invalid GitHub identity');
    }
    const githubId = String(profile.id);
    // Linking is allowed only when the signed state was issued to a logged-in user.
    // Provider identity never creates accounts, changes roles or matches by email.
    const user = session.linkUserId === undefined
      ? await this.users.findByGithubId(githubId)
      : await this.users.linkGithub(session.linkUserId, githubId);
    if (!user) {
      throw new UnauthorizedException('This GitHub account is not linked. Sign in to FleetCore first and link it from your profile.');
    }
    return this.auth.issueToken(user);
  }
}
