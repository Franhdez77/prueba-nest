import { Controller, Get, Post, Inject, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { PublicUser } from '../users/user.entity.js';
import { Public } from './decorators/public.decorator.js';
import { GithubOAuthService } from './github-oauth.service.js';
import { ApiErrors, ApiSuccess } from '../docs/api-responses.decorator.js';
import { LoginResponseDto } from '../docs/response.dto.js';

const cookieName = 'fleetcore_github_oauth';
const cookiePath = '/auth/github/callback';

@ApiTags('Autenticación')
@Controller('auth/github')
export class GithubOAuthController {
  constructor(@Inject(GithubOAuthService) private readonly github: GithubOAuthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Sign in with GitHub', description: 'Open this URL in a browser to start authorization.' })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub' })
  @ApiErrors(503)
  async start(@Res() response: Response) {
    const result = await this.github.start();
    response.cookie(cookieName, result.cookie, { httpOnly: true, secure: result.secure,
      sameSite: 'lax', path: cookiePath, maxAge: 600000 });
    response.setHeader('Cache-Control', 'no-store');
    response.redirect(result.url);
  }

  @Post('link')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link GitHub to my existing FleetCore account',
    description: 'Requires a FleetCore JWT. Open data.authorizationUrl in the same browser after this request.' })
  @ApiResponse({ status: 201, description: 'GitHub authorization URL; temporary state cookie set' })
  @ApiErrors(401, 503)
  async link(@CurrentUser() user: PublicUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.github.start(user.id);
    response.cookie(cookieName, result.cookie, { httpOnly: true, secure: result.secure,
      sameSite: 'lax', path: cookiePath, maxAge: 600000 });
    response.setHeader('Cache-Control', 'no-store');
    return { authorizationUrl: result.url };
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'GitHub callback', description: 'Used by GitHub. Returns the FleetCore JWT in data.accessToken.' })
  @ApiSuccess(200, LoginResponseDto)
  @ApiErrors(401, 409, 503)
  callback(@Query('code') code: unknown, @Query('state') state: unknown,
    @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookie = request.headers.cookie?.split(';').map(value => value.trim())
      .find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    response.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', path: cookiePath });
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.github.callback(code, state, cookie);
  }
}
