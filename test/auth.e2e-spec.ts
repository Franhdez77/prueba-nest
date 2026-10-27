import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import request from './http-request.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { User } from '../src/users/user.entity.js';
import { Role } from '../src/users/role.enum.js';

// Se ejecuta contra la base configurada y elimina únicamente sus propios usuarios.
describe('Autenticación y roles (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let jwt: JwtService;
  let technicianId: string;
  let token: string;
  let adminToken: string;
  const registeredEmails: string[] = [];
  let adminId: string;
  const email = `auth-${randomUUID()}@example.com`;
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const password = 'PruebaSegura123!';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    if (db) {
      await db.getRepository(User).delete({ email });
      await db.getRepository(User).delete({ email: adminEmail });
      for (const email of registeredEmails) await db.getRepository(User).delete({ email });
    }
    await app?.close();
  });

  it('valida los datos y rechaza la elección de rol en el registro público', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Técnico', email, password, role: 'ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: '', email: 'incorrecto', password: '123' })
      .expect(400);
  });

  it('registra un técnico, normaliza el correo y guarda un hash seguro', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Técnico de prueba', email: email.toUpperCase(), password })
      .expect(201);
    technicianId = res.body.data.id;
    expect(res.body.data).toMatchObject({ email, role: 'TECHNICIAN' });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.passwordHash).toBeUndefined();
    const stored = await db
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: technicianId })
      .getOneOrFail();
    expect(stored.passwordHash).not.toBe(password);
    expect(await verifyPassword(stored.passwordHash, password)).toBe(true);
  });

  it('devuelve 409 para un correo duplicado', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Duplicado', email, password })
      .expect(409);
  });

  it('rechaza credenciales incorrectas y permite iniciar sesión', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Incorrecta' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `absent-${randomUUID()}@example.com`, password })
      .expect(401);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    token = res.body.data.accessToken;
    expect(typeof token).toBe('string');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('protege el perfil ante tokens ausentes, inválidos o expirados', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer inválido')
      .expect(401);
    const expired = await jwt.signAsync(
      { sub: technicianId },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data).toMatchObject({
      id: technicianId,
      email,
      role: 'TECHNICIAN',
    });
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('rechaza al técnico en rutas ADMIN y permite al administrador', async () => {
    await request(app.getHttpServer())
      .post('/vehicles').send({ plate: 'INVALID', mileage: -1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    const admin = await db.getRepository(User).save(
      db.getRepository(User).create({
        name: 'Administrador de prueba',
        email: adminEmail,
        role: Role.ADMIN,
        passwordHash: await hashPassword(password),
      }),
    );
    adminId = admin.id;
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/vehicles').send({ plate: 'INVALID', mileage: -1 })
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .expect(400);
    adminToken = res.body.data.accessToken;
    expect(adminId).toBeTruthy();
  });
  it('permite a ADMIN registrar ambos roles y rechaza escaladas de privilegios', async () => {
    const input = { name: 'Usuario prueba', email: `registered-${randomUUID()}@example.com`, password, role: 'ADMIN' };
    await request(app.getHttpServer()).post('/auth/users').send(input).expect(401);
    await request(app.getHttpServer()).post('/auth/users').set('Authorization', `Bearer ${token}`).send(input).expect(403);
    await request(app.getHttpServer()).post('/auth/users').set('Authorization', `Bearer ${adminToken}`).send({ ...input, role: 'UNKNOWN' }).expect(400);
    for (const role of ['ADMIN', 'TECHNICIAN']) {
      const email = `registered-${randomUUID()}@example.com`;
      registeredEmails.push(email);
      const created = await request(app.getHttpServer()).post('/auth/users').set('Authorization', `Bearer ${adminToken}`).send({ ...input, email, role }).expect(201);
      expect(created.body.data.role).toBe(role);
      expect(created.body.data.passwordHash).toBeUndefined();
      const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
      expect(login.body.data.user.role).toBe(role);
      await request(app.getHttpServer()).post('/auth/users').set('Authorization', `Bearer ${adminToken}`).send({ ...input, email, role }).expect(409);
    }
  });

  it('exige API Key y no admite JWT como sustituto en integraciones', async () => {
    await request(app.getHttpServer()).get('/integrations/status').expect(401);
    await request(app.getHttpServer())
      .get('/integrations/status')
      .set('x-api-key', 'incorrecta')
      .expect(401);
    await request(app.getHttpServer())
      .get('/integrations/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    const apiKey = app.get(ConfigService).getOrThrow<string>('API_KEY');
    const res = await request(app.getHttpServer())
      .get('/integrations/status')
      .set('x-api-key', apiKey)
      .expect(200);
    expect(res.body).toMatchObject({
      success: true,
      statusCode: 200,
      path: '/integrations/status',
      data: { service: 'FleetCore', status: 'ok' },
    });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('x-api-key', apiKey)
      .expect(401);
  });

  it('mantiene el formato de errores para validación, permisos y rutas inexistentes', async () => {
    const validation = await request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
    expect(validation.body).toMatchObject({
      success: false,
      statusCode: 400,
      path: '/auth/login',
    });
    expect(Array.isArray(validation.body.message)).toBe(true);
    expect(Number.isNaN(Date.parse(validation.body.timestamp))).toBe(false);
    const forbidden = await request(app.getHttpServer())
      .post('/vehicles').send({ plate: 'INVALID', mileage: -1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(forbidden.body).toMatchObject({
      statusCode: 403,
      path: '/vehicles',
    });
    const missing = await request(app.getHttpServer())
      .get('/ruta-inexistente')
      .expect(404);
    expect(missing.body).toMatchObject({
      statusCode: 404,
      path: '/ruta-inexistente',
    });
  });
});
