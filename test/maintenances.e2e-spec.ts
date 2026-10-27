import { MaintenancesService } from '../src/maintenances/maintenances.service.js';
import type { CreateMaintenanceDto } from '../src/maintenances/dto/create-maintenance.dto.js';
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from './http-request.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { User } from '../src/users/user.entity.js';
import { Role } from '../src/users/role.enum.js';
import { Vehicle } from '../src/vehicles/vehicle.entity.js';
import { VehicleStatus } from '../src/vehicles/vehicle-status.enum.js';
import { Mechanic } from '../src/mechanics/mechanic.entity.js';
import { MechanicStatus } from '../src/mechanics/mechanic-status.enum.js';
import { Workshop } from '../src/workshops/workshop.entity.js';
import { WorkshopStatus } from '../src/workshops/workshop-status.enum.js';
import { Maintenance } from '../src/maintenances/maintenance.entity.js';
import { MaintenanceAudit } from '../src/maintenances/maintenance-audit.entity.js';
import { MaintenanceStatus as Status } from '../src/maintenances/maintenance.enums.js';

const time = (day: number, hour: string) => `2027-11-${String(day).padStart(2, '0')}T${hour}:00-05:00`;

describe('Mantenimientos (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let adminToken: string;
  let techToken: string;
  let otherToken: string;
  let mechanic: Mechanic;
  let otherMechanic: Mechanic;
  let inactiveMechanic: Mechanic;
  let workshop: Workshop;
  let otherWorkshop: Workshop;
  let inactiveWorkshop: Workshop;
  const suffix = randomBytes(8).toString('hex');
  const userIds: number[] = [];
  const vehicleIds: number[] = [];
  const mechanicIds: number[] = [];
  const workshopIds: number[] = [];
  let serial = 0;

  const send = (payload: object, token = adminToken) => request(app.getHttpServer()).post('/maintenances').set('Authorization', `Bearer ${token}`).send(payload);
  const change = (id: number, payload: object, token = adminToken) => request(app.getHttpServer()).patch(`/maintenances/${id}/status`).set('Authorization', `Bearer ${token}`).send(payload);
  const get = (path: string, token = adminToken) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  async function payload(day: number, start = '07:30', end = '09:00') {
    const vehicles = db.getRepository(Vehicle);
    const vehicle = await vehicles.save(vehicles.create({ plate: `M${suffix.slice(0, 6)}${serial++}`.toUpperCase(), brand: 'Toyota', model: 'Hilux', year: 2024, mileage: 45000, status: VehicleStatus.AVAILABLE }));
    vehicleIds.push(vehicle.id);
    return { type: 'PREVENTIVE', description: 'Cambio de filtros', mileage: 45000, scheduledStart: time(day, start), scheduledEnd: time(day, end), vehicleId: vehicle.id, mechanicId: mechanic.id, workshopId: workshop.id };
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    const users = db.getRepository(User);
    const jwt = app.get(JwtService);
    for (const [index, role] of [Role.ADMIN, Role.TECHNICIAN, Role.TECHNICIAN].entries()) {
      const user = await users.save(users.create({ name: `Prueba ${index}`, email: `maintenance-${suffix}-${index}@example.com`, passwordHash: 'unused', role }));
      userIds.push(user.id);
    }
    adminToken = await jwt.signAsync({ sub: String(userIds[0]) });
    techToken = await jwt.signAsync({ sub: String(userIds[1]) });
    otherToken = await jwt.signAsync({ sub: String(userIds[2]) });
    const mechanics = db.getRepository(Mechanic);
    for (let index = 0; index < 3; index++) {
      const record = await mechanics.save(mechanics.create({ name: `Mecánico ${index}`, email: `maintenance-mechanic-${suffix}-${index}@example.com`, specialty: 'Motor', userId: index < 2 ? userIds[index + 1] : null, status: index === 2 ? MechanicStatus.INACTIVE : MechanicStatus.ACTIVE }));
      mechanicIds.push(record.id);
      if (index === 0) mechanic = record;
      else if (index === 1) otherMechanic = record;
      else inactiveMechanic = record;
    }
    const workshops = db.getRepository(Workshop);
    for (let index = 0; index < 3; index++) {
      const record = await workshops.save(workshops.create({ name: `Taller ${suffix} ${index}`, address: 'Calle 50', status: index === 2 ? WorkshopStatus.INACTIVE : WorkshopStatus.ACTIVE }));
      workshopIds.push(record.id);
      if (index === 0) workshop = record;
      else if (index === 1) otherWorkshop = record;
      else inactiveWorkshop = record;
    }
  });

  afterAll(async () => {
    if (db) {
      const records = await db.getRepository(Maintenance).find({ where: { vehicleId: In(vehicleIds) } });
      if (records.length) await db.getRepository(MaintenanceAudit).delete({ maintenanceId: In(records.map(m => m.id)) });
      if (vehicleIds.length) {
        await db.getRepository(Maintenance).delete({ vehicleId: In(vehicleIds) });
        await db.getRepository(Vehicle).delete({ id: In(vehicleIds) });
      }
      if (mechanicIds.length) await db.getRepository(Mechanic).delete({ id: In(mechanicIds) });
      if (workshopIds.length) await db.getRepository(Workshop).delete({ id: In(workshopIds) });
      if (userIds.length) await db.getRepository(User).delete({ id: In(userIds) });
    }
    await app?.close();
  });

  it('protege el módulo y permite programar solo a ADMIN', async () => {
    await request(app.getHttpServer()).get('/maintenances').expect(401);
    await send(await payload(1), techToken).expect(403);
  });

  it('rechaza recursos inexistentes o inactivos y kilometraje inferior', async () => {
    const body = await payload(2);
    for (const field of ['vehicleId', 'mechanicId', 'workshopId']) await send({ ...body, [field]: 999999 }).expect(404);
    await send({ ...body, mechanicId: inactiveMechanic.id }).expect(409);
    await send({ ...body, workshopId: inactiveWorkshop.id }).expect(409);
    await db.getRepository(Vehicle).update(body.vehicleId, { status: VehicleStatus.INACTIVE });
    await send(body).expect(409);
    await db.getRepository(Vehicle).update(body.vehicleId, { status: VehicleStatus.AVAILABLE });
    await send({ ...body, mileage: 44999 }).expect(409);
  });

  it('valida fechas, tipos y campos de entrada', async () => {
    const body = await payload(3);
    await send({ ...body, scheduledEnd: body.scheduledStart }).expect(400);
    await send({ ...body, scheduledEnd: time(3, '07:00') }).expect(400);
    await send({ ...body, scheduledStart: '2027-11-03T07:30:00' }).expect(400);
    await send({ ...body, type: 'UNKNOWN' }).expect(400);
    await send({ ...body, status: 'COMPLETED' }).expect(400);
    for (const id of [0, -1, 1.5, '1', 2147483648]) await send({ ...body, vehicleId: id }).expect(400);
  });

  it('permite pendientes consecutivos y rechaza cruces en cualquier taller', async () => {
    const first = await payload(4);
    const { body } = await send(first).expect(201);
    expect(body.data).toMatchObject({ status: 'SCHEDULED', vehicleId: first.vehicleId, mechanicId: mechanic.id, workshopId: workshop.id });
    expect(body.data.workshop.name).toBe(workshop.name);
    await send({ ...first, mechanicId: otherMechanic.id, scheduledStart: time(5, '10:00'), scheduledEnd: time(5, '11:00') }).expect(409);
    const overlapping = await payload(4, '08:00', '10:00');
    await send(overlapping).expect(409);
    await send({ ...overlapping, workshopId: otherWorkshop.id }).expect(409);
    await send({ ...overlapping, scheduledStart: time(4, '06:00'), scheduledEnd: time(4, '10:00') }).expect(409);
    const second = await payload(4, '09:00', '10:00');
    await send({ ...second, workshopId: otherWorkshop.id }).expect(201);
    expect((await db.getRepository(Vehicle).findOneByOrFail({ id: first.vehicleId })).status).toBe('AVAILABLE');
  });

  it('serializa reservas simultáneas para evitar cruces y doble reserva del vehículo', async () => {
    const one = await payload(6);
    const two = await payload(6);
    const results = await Promise.all([send(one), send({ ...two, workshopId: otherWorkshop.id })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const shared = await payload(7);
    const vehicleResults = await Promise.all([send(shared), send({ ...shared, mechanicId: otherMechanic.id })]);
    expect(vehicleResults.map(r => r.status).sort()).toEqual([201, 409]);
  });

  it('limita consultas y cambios del técnico a sus propias asignaciones', async () => {
    const assigned = (await send(await payload(8)).expect(201)).body.data;
    const foreign = (await send({ ...await payload(8), mechanicId: otherMechanic.id }).expect(201)).body.data;
    const ownList = await get('/maintenances/mine', techToken).expect(200);
    expect(ownList.body.data.some((m: { id: number }) => m.id === assigned.id)).toBe(true);
    expect(ownList.body.data.every((m: { mechanicId: number }) => m.mechanicId === mechanic.id)).toBe(true);
    const root = await get(`/maintenances?mechanicId=${otherMechanic.id}`, techToken).expect(200);
    expect(root.body.data).toEqual([]);
    await get(`/maintenances/${foreign.id}`, techToken).expect(403);
    await change(foreign.id, { status: 'IN_PROGRESS' }, techToken).expect(403);
    await get(`/maintenances/mechanic/${otherMechanic.id}`, techToken).expect(403);
    await get(`/maintenances/${assigned.id}/audits`, techToken).expect(403);
    await get(`/maintenances/${assigned.id}`, techToken).expect(200);
    await get(`/maintenances/${foreign.id}`, otherToken).expect(200);
  });

  it('cancela solo pendientes, conserva el vehículo y no permite reabrirlos', async () => {
    const scheduled = (await send(await payload(9)).expect(201)).body.data;
    await change(scheduled.id, { status: 'COMPLETED', workPerformed: 'Trabajo', finalCost: 0, finishedAt: new Date().toISOString(), finalMileage: 45000 }).expect(409);
    await change(scheduled.id, { status: 'CANCELLED' }, techToken).expect(200);
    for (const status of Object.values(Status)) await change(scheduled.id, { status }).expect(status === Status.COMPLETED ? 400 : 409);
    expect((await db.getRepository(Vehicle).findOneByOrFail({ id: scheduled.vehicleId })).status).toBe('AVAILABLE');
    await send({ ...await payload(9), scheduledStart: time(9, '07:30'), scheduledEnd: time(9, '09:00') }).expect(201);
  });

  it('controla ejecución única, exige cierre completo y actualiza vehículo y auditoría', async () => {
    const one = (await send(await payload(10)).expect(201)).body.data;
    const two = (await send(await payload(11)).expect(201)).body.data;
    const started = await change(one.id, { status: 'IN_PROGRESS' }, techToken).expect(200);
    expect(started.body.data.vehicle.status).toBe('IN_MAINTENANCE');
    await change(two.id, { status: 'IN_PROGRESS' }, techToken).expect(409);
    await change(one.id, { status: 'CANCELLED' }, techToken).expect(409);
    await change(one.id, { status: 'COMPLETED' }, techToken).expect(400);
    const close = { status: 'COMPLETED', workPerformed: 'Cambio de aceite y filtros', finalCost: 250000.25, finishedAt: new Date().toISOString(), finalMileage: 45100 };
    await change(one.id, { ...close, finalMileage: 44999 }, techToken).expect(409);
    await change(one.id, { ...close, finalCost: -1 }, techToken).expect(400);
    await change(one.id, { ...close, finishedAt: '2000-01-01T00:00:00Z' }, techToken).expect(409);
    const completed = await change(one.id, close, techToken).expect(200);
    expect(completed.body.data).toMatchObject({ status: 'COMPLETED', finalCost: '250000.25', finalMileage: 45100, vehicle: { status: 'AVAILABLE', mileage: 45100 } });
    await change(one.id, { status: 'IN_PROGRESS' }).expect(409);
    await change(one.id, { status: 'CANCELLED' }).expect(409);
    const audits = await get(`/maintenances/${one.id}/audits`).expect(200);
    expect(audits.body.data.map((a: { toStatus: string }) => a.toStatus)).toEqual(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']);
    const history = await get(`/maintenances/vehicle/${one.vehicleId}/history`).expect(200);
    expect(history.body.data[0].id).toBe(one.id);
    await change(two.id, { status: 'IN_PROGRESS' }).expect(200);
    await change(two.id, { ...close, finishedAt: new Date().toISOString() }).expect(200);
  });

  it('permite solo un inicio cuando dos solicitudes del mismo mecánico compiten', async () => {
    const first = (await send(await payload(13)).expect(201)).body.data;
    const second = (await send(await payload(14)).expect(201)).body.data;
    const attempts = await Promise.all([
      change(first.id, { status: 'IN_PROGRESS' }),
      change(second.id, { status: 'IN_PROGRESS' }),
    ]);
    expect(attempts.map(r => r.status).sort()).toEqual([200, 409]);
    const running = attempts.find(r => r.status === 200)!.body.data;
    const blocked = attempts.find(r => r.status === 409)!;
    expect(blocked.body.success).toBe(false);
    const loser = running.id === first.id ? second : first;
    expect((await db.getRepository(Vehicle).findOneByOrFail({ id: loser.vehicleId })).status).toBe('AVAILABLE');
    expect(await db.getRepository(MaintenanceAudit).countBy({ maintenanceId: loser.id })).toBe(1);
    await change(running.id, { status: 'COMPLETED', workPerformed: 'Revisión', finalCost: 0, finishedAt: new Date().toISOString(), finalMileage: 45000 }).expect(200);
  });

  it('revalida recursos al iniciar si fueron inactivados después de programar', async () => {
    const scheduled = (await send(await payload(15)).expect(201)).body.data;
    await db.getRepository(Workshop).update(workshop.id, { status: WorkshopStatus.INACTIVE });
    await change(scheduled.id, { status: 'IN_PROGRESS' }).expect(409);
    await db.getRepository(Workshop).update(workshop.id, { status: WorkshopStatus.ACTIVE });
    await db.getRepository(Mechanic).update(mechanic.id, { status: MechanicStatus.INACTIVE });
    await change(scheduled.id, { status: 'IN_PROGRESS' }).expect(409);
    await db.getRepository(Mechanic).update(mechanic.id, { status: MechanicStatus.ACTIVE });
    await db.getRepository(Vehicle).update(scheduled.vehicleId, { status: VehicleStatus.INACTIVE });
    await change(scheduled.id, { status: 'IN_PROGRESS' }).expect(409);
    expect((await db.getRepository(Maintenance).findOneByOrFail({ id: scheduled.id })).status).toBe('SCHEDULED');
    expect(await db.getRepository(MaintenanceAudit).countBy({ maintenanceId: scheduled.id })).toBe(1);
  });

  it('conserva historial y auditoría al inactivar el vehículo y el mecánico', async () => {
    const record = (await send({ ...await payload(16), mechanicId: otherMechanic.id }).expect(201)).body.data;
    await change(record.id, { status: 'IN_PROGRESS' }, otherToken).expect(200);
    await change(record.id, { status: 'COMPLETED', workPerformed: 'Revisión completa', finalCost: 0, finishedAt: new Date().toISOString(), finalMileage: 45000 }, otherToken).expect(200);
    await request(app.getHttpServer()).delete(`/vehicles/${record.vehicleId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app.getHttpServer()).delete(`/mechanics/${otherMechanic.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const history = await get(`/maintenances/vehicle/${record.vehicleId}/history`).expect(200);
    expect(history.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: record.id, status: 'COMPLETED', vehicle: expect.objectContaining({ status: 'INACTIVE' }), mechanic: expect.objectContaining({ status: 'INACTIVE' }) }),
    ]));
    const audits = await get(`/maintenances/${record.id}/audits`).expect(200);
    expect(audits.body.data.map((entry: { toStatus: string }) => entry.toStatus)).toEqual(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']);
  });

  it('filtra activos e historial y valida identificadores y filtros', async () => {
    const active = await get('/maintenances?active=true').expect(200);
    expect(active.body.data.every((m: { status: string }) => ['SCHEDULED', 'IN_PROGRESS'].includes(m.status))).toBe(true);
    const closed = await get('/maintenances?active=false&type=PREVENTIVE').expect(200);
    expect(closed.body.data.every((m: { status: string }) => ['COMPLETED', 'CANCELLED'].includes(m.status))).toBe(true);
    for (const value of ['incorrecto', '1', '0']) await get(`/maintenances?active=${value}`).expect(400);
    await get('/maintenances?vehicleId=0').expect(400);
    await get('/maintenances?mechanicId=2147483648').expect(400);
    await get('/maintenances/incorrecto').expect(400);
    await get(`/maintenances/${999999}`).expect(404);
    await get(`/maintenances/vehicle/${999999}/history`).expect(404);
    await get(`/maintenances/mechanic/${999999}`).expect(404);
  });
  it('rolls back all DAO writes when the audit insert fails', async () => {
    const service = app.get(MaintenancesService);
    const input = await payload(28);
    const invalidActor = { id: 0, name: 'Missing actor', email: 'missing@example.com', role: Role.ADMIN, createdAt: new Date() };
    // A missing audit actor forces a real foreign-key failure after persistence.
    await expect(service.create(input as CreateMaintenanceDto, invalidActor)).rejects.toMatchObject({ driverError: { code: '23503' } });
    expect(await db.getRepository(Maintenance).countBy({ vehicleId: input.vehicleId })).toBe(0);

    const record = (await send(input).expect(201)).body.data;
    await expect(service.updateStatus(record.id, { status: Status.IN_PROGRESS }, invalidActor)).rejects.toMatchObject({ driverError: { code: '23503' } });
    const stored = await db.getRepository(Maintenance).findOneByOrFail({ id: record.id });
    const vehicle = await db.getRepository(Vehicle).findOneByOrFail({ id: input.vehicleId });
    expect(stored.status).toBe(Status.SCHEDULED);
    expect(stored.startedAt).toBeNull();
    expect(vehicle.status).toBe(VehicleStatus.AVAILABLE);
    expect(vehicle.mileage).toBe(45000);
    expect(await db.getRepository(MaintenanceAudit).countBy({ maintenanceId: record.id })).toBe(1);
  });

});
