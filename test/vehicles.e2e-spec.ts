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
import { Vehicle } from '../src/vehicles/vehicle.entity.js';
import { VehicleStatus } from '../src/vehicles/vehicle-status.enum.js';

describe('Vehículos (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let adminToken: string;
  let technicianToken: string;
  let vehicleId: string;
  const suffix = randomUUID();
  const plate = `TEST-${suffix.slice(0, 8).toUpperCase()}`;
  const payload = {
    plate: plate.toLowerCase(),
    brand: 'Toyota',
    model: 'Hilux',
    year: 2024,
    mileage: 45000,
  };
  const emails = [
    `vehicles-admin-${suffix}@example.com`,
    `vehicles-tech-${suffix}@example.com`,
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    const jwt = app.get(JwtService);
    const users = db.getRepository(User);
    // Issue fixture tokens directly; this suite tests vehicles and role authorization.
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
    adminToken = await jwt.signAsync({ sub: admin.id });
    technicianToken = await jwt.signAsync({ sub: technician.id });
  });

  afterAll(async () => {
    if (db) {
      await db.getRepository(Vehicle).delete({ plate });
      for (const email of emails)
        await db.getRepository(User).delete({ email });
    }
    await app?.close();
  });

  it('exige autenticación y reserva las modificaciones para ADMIN', async () => {
    await request(app.getHttpServer()).get('/vehicles').expect(401);
    await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${technicianToken}`)
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/vehicles/${randomUUID()}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ model: 'Otro' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/vehicles/${randomUUID()}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(403);
  });

  it('valida los datos y registra un vehículo disponible con placa normalizada', async () => {
    await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, mileage: -1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...payload, status: 'IN_MAINTENANCE' })
      .expect(400);
    const { body } = await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    vehicleId = body.data.id;
    expect(body.data).toMatchObject({
      plate,
      status: 'AVAILABLE',
      mileage: 45000,
    });
    await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(409);
  });

  it('permite consultar por ID, placa y estado a un usuario autenticado', async () => {
    const found = await request(app.getHttpServer())
      .get(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(found.body.data.plate).toBe(plate);
    const byPlate = await request(app.getHttpServer())
      .get(`/vehicles/plate/${plate.toLowerCase()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(byPlate.body.data.id).toBe(vehicleId);
    const listed = await request(app.getHttpServer())
      .get('/vehicles?status=AVAILABLE')
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(200);
    expect(
      listed.body.data.some((v: { id: string }) => v.id === vehicleId),
    ).toBe(true);
    await request(app.getHttpServer())
      .get('/vehicles?status=UNKNOWN')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/vehicles/invalid-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/vehicles/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/vehicles/plate/NOT-FOUND')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('actualiza datos y rechaza valores nulos en campos obligatorios', async () => {
    const updated = await request(app.getHttpServer()).patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mileage: 50000, model: 'Hilux 4x4' }).expect(200);
    expect(updated.body.data).toMatchObject({ mileage: 50000, model: 'Hilux 4x4' });
    await request(app.getHttpServer()).patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ brand: null }).expect(400);
    await request(app.getHttpServer()).patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: null }).expect(400);
  });

  it('inactiva sin eliminar datos y permite reactivar', async () => {
    const inactive = await request(app.getHttpServer())
      .delete(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(inactive.body.data.status).toBe('INACTIVE');
    expect(await db.getRepository(Vehicle).existsBy({ id: vehicleId })).toBe(
      true,
    );
    const active = await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AVAILABLE' })
      .expect(200);
    expect(active.body.data.status).toBe('AVAILABLE');
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_MAINTENANCE' })
      .expect(400);
  });

  it('impide liberar, inactivar o alterar kilometraje durante una intervención', async () => {
    await db
      .getRepository(Vehicle)
      .update(vehicleId, { status: VehicleStatus.IN_MAINTENANCE });
    await request(app.getHttpServer())
      .delete(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AVAILABLE' })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mileage: 53000 })
      .expect(409);
  });
});
