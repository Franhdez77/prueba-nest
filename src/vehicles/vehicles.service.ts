import {
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { VehiclesDao } from './vehicles.dao.js';
import { VehicleStatus } from './vehicle-status.enum.js';
import type { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import type { ListVehiclesDto } from './dto/list-vehicles.dto.js';

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(VehiclesDao) private readonly vehicles: VehiclesDao,
  ) {}

  create(dto: CreateVehicleDto) {
    return this.vehicles.create({
      plate: dto.plate, brand: dto.brand, model: dto.model,
      year: dto.year, mileage: dto.mileage, status: VehicleStatus.AVAILABLE,
    });
  }

  findAll(query: ListVehiclesDto) {
    return this.vehicles.findAll(query.status);
  }

  async findOne(id: number) {
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    return vehicle;
  }

  async findByPlate(plate: string) {
    const vehicle = await this.vehicles.findByPlate(plate.trim().toUpperCase());
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    return vehicle;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    // Lock the vehicle row to serialize updates with maintenance operations.
    return this.vehicles.transaction(async (dao) => {
      const vehicle = await dao.findLocked(id);
      if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
      if (
        vehicle.status === VehicleStatus.IN_MAINTENANCE &&
        (dto.status !== undefined || dto.mileage !== undefined)
      ) {
        throw new ConflictException(
          'El estado y kilometraje se actualizan desde el mantenimiento en proceso',
        );
      }
      Object.assign(vehicle, dto);
      return dao.save(vehicle);
    });
  }

  deactivate(id: number) {
    // Deactivate the record while preserving its identity and historical relationships.
    return this.update(id, { status: VehicleStatus.INACTIVE });
  }
}
