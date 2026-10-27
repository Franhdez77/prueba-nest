import { Maintenance } from '../maintenances/maintenance.entity.js';
import { MaintenanceAudit } from '../maintenances/maintenance-audit.entity.js';
import { MaintenanceStatus, MaintenanceType } from '../maintenances/maintenance.enums.js';
import { Workshop } from '../workshops/workshop.entity.js';
import { WorkshopStatus } from '../workshops/workshop-status.enum.js';
import dataSource from './data-source.js';
import { hashPassword } from '../auth/password.js';
import { User } from '../users/user.entity.js';
import { Role } from '../users/role.enum.js';
import { Mechanic } from '../mechanics/mechanic.entity.js';
import { MechanicStatus } from '../mechanics/mechanic-status.enum.js';
import { Vehicle } from '../vehicles/vehicle.entity.js';
import { VehicleStatus } from '../vehicles/vehicle-status.enum.js';

// Datos de prueba del enunciado para los módulos disponibles; no sobrescribe registros.
await dataSource.initialize();
try {
  await dataSource.transaction(async (manager) => {
    const users = manager.getRepository(User);
    const passwordHash = await hashPassword('FleetCore123!');
    const definitions = [
      { name: 'Administrador', email: 'admin@fleetcore.test', role: Role.ADMIN },
      { name: 'Técnico uno', email: 'tecnico1@fleetcore.test', role: Role.TECHNICIAN },
      { name: 'Técnico dos', email: 'tecnico2@fleetcore.test', role: Role.TECHNICIAN },
    ];
    const created: User[] = [];
    for (const definition of definitions) {
      const existing = await users.findOneBy({ email: definition.email });
      created.push(existing ?? await users.save(users.create({ ...definition, passwordHash })));
    }
    const mechanics = manager.getRepository(Mechanic);
    for (const definition of [
      { name: 'Técnico uno', email: 'tecnico1@fleetcore.test', specialty: 'Motor', status: MechanicStatus.ACTIVE, userId: created[1].id },
      { name: 'Técnico dos', email: 'tecnico2@fleetcore.test', specialty: 'Frenos', status: MechanicStatus.ACTIVE, userId: created[2].id },
      { name: 'Mecánico inactivo', email: 'inactivo@fleetcore.test', specialty: 'Suspensión', status: MechanicStatus.INACTIVE, userId: null },
    ]) {
      if (!await mechanics.existsBy({ email: definition.email })) await mechanics.save(mechanics.create(definition));
    }
    const workshops = manager.getRepository(Workshop);
    for (const definition of [
      { id: '40000000-0000-4000-8000-000000000001', name: 'Taller Norte', address: 'Calle 50 # 20-30', status: WorkshopStatus.ACTIVE },
      { id: '40000000-0000-4000-8000-000000000002', name: 'Taller Centro', address: 'Carrera 10 # 15-20', status: WorkshopStatus.INACTIVE },
    ]) {
      if (!await workshops.existsBy({ id: definition.id })) {
        await workshops.save(workshops.create(definition));
      }
    }
    const vehicles = manager.getRepository(Vehicle);
    for (const definition of [
      { plate: 'ABC123', status: VehicleStatus.AVAILABLE },
      { plate: 'DEF456', status: VehicleStatus.AVAILABLE },
      { plate: 'GHI789', status: VehicleStatus.INACTIVE },
    ]) {
      if (!await vehicles.existsBy({ plate: definition.plate })) {
        await vehicles.save(vehicles.create({ ...definition, brand: 'Chevrolet', model: 'NPR', year: 2024, mileage: 45000 }));
      }
    }
    const activeVehicleId = '50000000-0000-4000-8000-000000000004';
    if (!await vehicles.existsBy({ id: activeVehicleId })) {
      await vehicles.save(vehicles.create({
        id: activeVehicleId, plate: 'JKL012', brand: 'Chevrolet', model: 'NPR',
        year: 2024, mileage: 60000, status: VehicleStatus.IN_MAINTENANCE,
      }));
    }
    const mechanicOne = await mechanics.findOneByOrFail({ email: 'tecnico1@fleetcore.test' });
    const mechanicTwo = await mechanics.findOneByOrFail({ email: 'tecnico2@fleetcore.test' });
    const historyVehicle = await vehicles.findOneByOrFail({ plate: 'DEF456' });
    const maintenances = manager.getRepository(Maintenance);
    const audits = manager.getRepository(MaintenanceAudit);
    const samples = [
      {
        id: '60000000-0000-4000-8000-000000000001', vehicleId: activeVehicleId,
        mechanicId: mechanicOne.id, workshopId: '40000000-0000-4000-8000-000000000001',
        type: MaintenanceType.CORRECTIVE, description: 'Revisión del sistema de frenos',
        mileage: 60000, scheduledStart: new Date('2026-10-27T07:30:00-05:00'),
        scheduledEnd: new Date('2026-10-27T09:00:00-05:00'),
        startedAt: new Date('2026-10-27T07:30:00-05:00'), status: MaintenanceStatus.IN_PROGRESS,
      },
      {
        id: '60000000-0000-4000-8000-000000000002', vehicleId: historyVehicle.id,
        mechanicId: mechanicTwo.id, workshopId: '40000000-0000-4000-8000-000000000001',
        type: MaintenanceType.PREVENTIVE, description: 'Cambio de aceite y filtros',
        mileage: 44000, scheduledStart: new Date('2026-10-20T07:30:00-05:00'),
        scheduledEnd: new Date('2026-10-20T09:00:00-05:00'),
        startedAt: new Date('2026-10-20T07:30:00-05:00'), status: MaintenanceStatus.COMPLETED,
        workPerformed: 'Aceite y filtros reemplazados', finalCost: '250000.00',
        finishedAt: new Date('2026-10-20T09:00:00-05:00'), finalMileage: 45000,
      },
    ];
    for (const sample of samples) {
      if (await maintenances.existsBy({ id: sample.id })) continue;
      await maintenances.save(maintenances.create(sample));
      const transitions: Array<[MaintenanceStatus | null, MaintenanceStatus, Date]> = [
        [null, MaintenanceStatus.SCHEDULED, new Date(sample.scheduledStart.getTime() - 60000)],
        [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS, sample.startedAt],
      ];
      if (sample.status === MaintenanceStatus.COMPLETED && sample.finishedAt) {
        transitions.push([MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.COMPLETED, sample.finishedAt]);
      }
      for (const [fromStatus, toStatus, createdAt] of transitions) {
        await audits.save(audits.create({ maintenanceId: sample.id, actorId: created[0].id, fromStatus, toStatus, createdAt }));
      }
    }

  });
  console.log('Seed ejecutado: usuarios, mecánicos, talleres, vehículos, mantenimientos e historial.');
} finally {
  await dataSource.destroy();
}
