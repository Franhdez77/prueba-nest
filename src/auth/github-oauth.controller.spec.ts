import { jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { GithubOAuthController } from './github-oauth.controller.js';
import { GithubOAuthService } from './github-oauth.service.js';

it('sets a scoped HttpOnly cookie and redirects the browser to GitHub', async () => {
  const start = jest.fn<GithubOAuthService['start']>().mockResolvedValue({ cookie: 'state-cookie', url: 'https://github.com/login/oauth/authorize', secure: true });
  const response = { cookie: jest.fn(), setHeader: jest.fn(), redirect: jest.fn() };
  const controller = new GithubOAuthController({ start } as unknown as GithubOAuthService);
  await controller.start(response as unknown as Response);
  expect(response.cookie).toHaveBeenCalledWith('fleetcore_github_oauth', 'state-cookie', expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/github/callback' }));
  expect(response.redirect).toHaveBeenCalledWith('https://github.com/login/oauth/authorize');
});

it('reads only the OAuth cookie, clears it, and prevents caching the returned JWT', async () => {
  const callback = jest.fn<GithubOAuthService['callback']>();
  const response = { clearCookie: jest.fn(), setHeader: jest.fn() };
  const controller = new GithubOAuthController({ callback } as unknown as GithubOAuthService);
  await controller.callback('code', 'state', { headers: { cookie: 'other=unrelated; fleetcore_github_oauth=signed-cookie' } } as Request, response as unknown as Response);
  expect(callback).toHaveBeenCalledWith('code', 'state', 'signed-cookie');
  expect(response.clearCookie).toHaveBeenCalled();
  expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('starts linking with the authenticated user ID and never a client-supplied ID', async () => {
  const start = jest.fn<GithubOAuthService['start']>().mockResolvedValue({ cookie: 'link-cookie', url: 'https://github.com/login/oauth/authorize', secure: false });
  const response = { cookie: jest.fn(), setHeader: jest.fn() };
  const controller = new GithubOAuthController({ start } as unknown as GithubOAuthService);
  const result = await controller.link({ id: 7 } as import('../users/user.entity.js').PublicUser, response as unknown as Response);
  expect(start).toHaveBeenCalledWith(7);
  expect(result).toEqual({ authorizationUrl: 'https://github.com/login/oauth/authorize' });
  expect(response.cookie).toHaveBeenCalledWith('fleetcore_github_oauth', 'link-cookie', expect.objectContaining({ httpOnly: true }));
});
