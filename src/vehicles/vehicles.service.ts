import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity.js';
import { VehicleStatus } from './vehicle-status.enum.js';
import type { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import type { ListVehiclesDto } from './dto/list-vehicles.dto.js';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
  ) {}

  create(dto: CreateVehicleDto) {
    return this.vehicles.save(
      this.vehicles.create({
        plate: dto.plate,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        mileage: dto.mileage,
        status: VehicleStatus.AVAILABLE,
      }),
    );
  }

  findAll(query: ListVehiclesDto) {
    return this.vehicles.find({
      where: query.status ? { status: query.status } : {},
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.vehicles.findOneBy({ id });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    return vehicle;
  }

  async findByPlate(plate: string) {
    const vehicle = await this.vehicles.findOneBy({
      plate: plate.trim().toUpperCase(),
    });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto) {
    // El bloqueo serializa los cambios del vehículo con sus intervenciones.
    return this.vehicles.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Vehicle);
      const vehicle = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
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
      return repository.save(vehicle);
    });
  }

  deactivate(id: string) {
    // La inactivación conserva el registro y sus relaciones históricas.
    return this.update(id, { status: VehicleStatus.INACTIVE });
  }
}
