import { setupSwagger } from '../src/docs/setup-swagger.js';
import { configureApp } from '../src/common/configure-app.js';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from './http-request.js';
import { AppModule } from './../src/app.module.js';

describe('Swagger (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  it('sirve Swagger y documenta correctamente JWT, API Key y respuestas', async () => {
    await request(app.getHttpServer())
      .get('/docs/')
      .expect(200)
      .expect('Content-Type', /html/);
    const { body } = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(body.info.title).toBe('FleetCore API');
    expect(body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(body.components.securitySchemes['api-key']).toMatchObject({
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    });
    expect(body.paths['/auth/login'].post.security ?? []).toEqual([]);
    expect(body.paths['/auth/register'].post.security).toEqual([{ bearer: [] }]);
    expect(body.paths['/auth/me'].get.security).toEqual([{ bearer: [] }]);
    expect(body.paths['/integrations/status'].get.security).toEqual([
      { 'api-key': [] },
    ]);
    expect(body.components.schemas.RegisterDto.required).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
    expect(body.components.schemas.RegisterDto.properties.role).toBeUndefined();
    expect(
      body.components.schemas.UserResponseDto.properties.passwordHash,
    ).toBeUndefined();
    const loginSchema =
      body.paths['/auth/login'].post.responses['200'].content[
        'application/json'
      ].schema;
    expect(loginSchema.properties.data.$ref).toBe(
      '#/components/schemas/LoginResponseDto',
    );
    expect(body.paths['/vehicles'].post.responses['403']).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
