import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from './http-request.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { User } from '../src/users/user.entity.js';
import { Role } from '../src/users/role.enum.js';
import { Mechanic } from '../src/mechanics/mechanic.entity.js';

describe('Mecánicos (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let adminToken: string;
  let technicianToken: string;
  let adminId: string;
  let technicianId: string;
  let mechanicId: string;
  let secondMechanicId: string;
  const suffix = randomUUID();
  const emails = [
    `mechanic-admin-${suffix}@example.com`,
    `mechanic-tech-${suffix}@example.com`,
  ];
  const mechanicEmails = [
    `mechanic-${suffix}@example.com`,
    `mechanic-second-${suffix}@example.com`,
  ];
  const payload = {
    name: 'Juan Pérez',
    email: mechanicEmails[0].toUpperCase(),
    specialty: 'Motores diésel',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    const users = db.getRepository(User);
    const admin = await users.save(
      users.create({
        name: 'Admin prueba',
        email: emails[0],
        passwordHash: 'unused',
        role: Role.ADMIN,
      }),
    );
    const technician = await users.save(
      users.create({
        name: 'Técnico prueba',
        email: emails[1],
        passwordHash: 'unused',
        role: Role.TECHNICIAN,
      }),
    );
    adminId = admin.id;
    technicianId = technician.id;
    const jwt = app.get(JwtService);
    adminToken = await jwt.signAsync({ sub: adminId });
    technicianToken = await jwt.signAsync({ sub: technicianId });
  });

  afterAll(async () => {
    if (db) {
      for (const email of mechanicEmails)
        await db.getRepository(Mechanic).delete({ email });
      for (const email of emails)
        await db.getRepository(User).delete({ email });
    }
    await app?.close();
  });

  it('exige JWT y reserva las modificaciones para ADMIN', async () => {
    await request(app.getHttpServer()).get('/mechanics').expect(401);
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/mechanics/${randomUUID()}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ status: 'INACTIVE' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/mechanics/${randomUUID()}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(403);
  });

  it('valida el cuerpo y el usuario vinculado', async () => {
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, specialty: '' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, userId: 'incorrecto' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, userId: randomUUID() })
      .expect(404);
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, userId: adminId })
      .expect(409);
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, workshopId: randomUUID() })
      .expect(400);
  });

  it('registra un mecánico activo vinculado a un técnico sin exponer credenciales', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, userId: technicianId })
      .expect(201);
    mechanicId = body.data.id;
    expect(body.data).toMatchObject({
      email: mechanicEmails[0],
      status: 'ACTIVE',
      userId: technicianId,
    });
    expect(body.data.user).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(409);
    await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, email: mechanicEmails[1], userId: technicianId })
      .expect(409);
  });

  it('permite consultas y devuelve errores apropiados para filtros e IDs inválidos', async () => {
    const found = await request(app.getHttpServer())
      .get(`/mechanics/${mechanicId}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(found.body.data.id).toBe(mechanicId);
    const listed = await request(app.getHttpServer())
      .get('/mechanics?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      listed.body.data.some((m: { id: string }) => m.id === mechanicId),
    ).toBe(true);
    await request(app.getHttpServer())
      .get('/mechanics?status=UNKNOWN')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/mechanics/invalid')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/mechanics/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('actualiza, permite desvincular y evita duplicar el vínculo en actualizaciones', async () => {
    const second = await request(app.getHttpServer())
      .post('/mechanics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, email: mechanicEmails[1] })
      .expect(201);
    secondMechanicId = second.body.data.id;
    expect(second.body.data.userId).toBeNull();
    await request(app.getHttpServer())
      .patch(`/mechanics/${secondMechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: technicianId })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/mechanics/${secondMechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: mechanicEmails[0].toUpperCase() })
      .expect(409);
    const updated = await request(app.getHttpServer())
      .patch(`/mechanics/${mechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ specialty: 'Frenos', userId: null })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      specialty: 'Frenos',
      userId: null,
    });
    await request(app.getHttpServer())
      .patch(`/mechanics/${mechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: technicianId })
      .expect(200);
    for (const field of ['name', 'email', 'specialty', 'status']) {
      await request(app.getHttpServer())
        .patch(`/mechanics/${mechanicId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ [field]: null })
        .expect(400);
    }
    await request(app.getHttpServer())
      .patch(`/mechanics/${mechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: adminId })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/mechanics/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ specialty: 'Frenos' })
      .expect(404);
  });

  it('inactiva y reactiva conservando el registro y su vínculo', async () => {
    const inactive = await request(app.getHttpServer())
      .delete(`/mechanics/${mechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(inactive.body.data).toMatchObject({
      status: 'INACTIVE',
      userId: technicianId,
    });
    expect(await db.getRepository(Mechanic).existsBy({ id: mechanicId })).toBe(
      true,
    );
    const filtered = await request(app.getHttpServer())
      .get('/mechanics?status=INACTIVE')
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(
      filtered.body.data.some((m: { id: string }) => m.id === mechanicId),
    ).toBe(true);
    const active = await request(app.getHttpServer())
      .patch(`/mechanics/${mechanicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(active.body.data).toMatchObject({
      status: 'ACTIVE',
      specialty: 'Frenos',
      userId: technicianId,
    });
  });
});
