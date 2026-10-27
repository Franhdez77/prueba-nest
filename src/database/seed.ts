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
  });
  console.log('Seed ejecutado. Pendientes mantenimientos para completar los datos del enunciado.');
} finally {
  await dataSource.destroy();
}
