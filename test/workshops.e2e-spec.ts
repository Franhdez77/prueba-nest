import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from './http-request.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { User } from '../src/users/user.entity.js';
import { Role } from '../src/users/role.enum.js';
import { Workshop } from '../src/workshops/workshop.entity.js';

describe('Talleres (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let adminToken: string;
  let technicianToken: string;
  let workshopId: number;
  const suffix = randomBytes(8).toString('hex');
  const name = `Taller prueba ${suffix}`;
  const emails = [`workshop-admin-${suffix}@example.com`, `workshop-tech-${suffix}@example.com`];
  const payload = { name, address: 'Calle 50 # 20-30' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    const users = db.getRepository(User);
    const jwt = app.get(JwtService);
    const admin = await users.save(users.create({ name: 'Admin prueba', email: emails[0], passwordHash: 'unused', role: Role.ADMIN }));
    const technician = await users.save(users.create({ name: 'Técnico prueba', email: emails[1], passwordHash: 'unused', role: Role.TECHNICIAN }));
    adminToken = await jwt.signAsync({ sub: String(admin.id) });
    technicianToken = await jwt.signAsync({ sub: String(technician.id) });
  });

  afterAll(async () => {
    if (db) {
      await db.getRepository(Workshop).delete({ name });
      for (const email of emails) await db.getRepository(User).delete({ email });
    }
    await app?.close();
  });

  it('protege consultas y reserva el registro y cambios de estado para ADMIN', async () => {
    await request(app.getHttpServer()).get('/workshops').expect(401);
    await request(app.getHttpServer()).post('/workshops').set('Authorization', `Bearer ${technicianToken}`).send(payload).expect(403);
    await request(app.getHttpServer()).patch(`/workshops/${999999}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'INACTIVE' }).expect(403);
  });

  it('valida los datos y crea un taller activo', async () => {
    for (const invalid of [{ name: ' ' }, { address: null }, { address: '' }, { status: 'INACTIVE' }]) {
      await request(app.getHttpServer()).post('/workshops').set('Authorization', `Bearer ${adminToken}`).send({ ...payload, ...invalid }).expect(400);
    }
    const { body } = await request(app.getHttpServer()).post('/workshops').set('Authorization', `Bearer ${adminToken}`).send(payload).expect(201);
    workshopId = body.data.id;
    expect(body).toMatchObject({ success: true, statusCode: 201, data: { ...payload, status: 'ACTIVE' } });
  });

  it('permite consultar y listar activos a usuarios autenticados', async () => {
    const found = await request(app.getHttpServer()).get(`/workshops/${workshopId}`).set('Authorization', `Bearer ${technicianToken}`).expect(200);
    expect(found.body.data).toMatchObject(payload);
    const listed = await request(app.getHttpServer()).get('/workshops').set('Authorization', `Bearer ${technicianToken}`).expect(200);
    expect(listed.body.data.some((w: { id: number }) => w.id === workshopId)).toBe(true);
    expect(listed.body.data.every((w: { status: string }) => w.status === 'ACTIVE')).toBe(true);
  });

  it('inactiva sin eliminar y excluye el taller del listado de activos', async () => {
    await request(app.getHttpServer()).patch(`/workshops/${workshopId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'INACTIVE' }).expect(200);
    const found = await request(app.getHttpServer()).get(`/workshops/${workshopId}`).set('Authorization', `Bearer ${technicianToken}`).expect(200);
    expect(found.body.data.status).toBe('INACTIVE');
    expect(await db.getRepository(Workshop).existsBy({ id: workshopId })).toBe(true);
    const listed = await request(app.getHttpServer()).get('/workshops').set('Authorization', `Bearer ${technicianToken}`).expect(200);
    expect(listed.body.data.some((w: { id: number }) => w.id === workshopId)).toBe(false);
    const active = await request(app.getHttpServer()).patch(`/workshops/${workshopId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACTIVE' }).expect(200);
    expect(active.body.data.status).toBe('ACTIVE');
  });

  it('rechaza estados inválidos y devuelve 400 o 404 para identificadores incorrectos', async () => {
    for (const status of ['UNKNOWN', null, undefined]) {
      await request(app.getHttpServer()).patch(`/workshops/${workshopId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status }).expect(400);
    }
    await request(app.getHttpServer()).get('/workshops/incorrecto').set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer()).get(`/workshops/${999999}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app.getHttpServer()).patch(`/workshops/${999999}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACTIVE' }).expect(404);
  });
});
