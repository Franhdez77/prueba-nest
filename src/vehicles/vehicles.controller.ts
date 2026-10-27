import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/role.enum.js';
import { ApiErrors, ApiSuccess } from '../docs/api-responses.decorator.js';
import { Vehicle } from './vehicle.entity.js';
import { VehiclesService } from './vehicles.service.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { ListVehiclesDto } from './dto/list-vehicles.dto.js';

@ApiTags('Vehículos')
@ApiBearerAuth()
@ApiErrors(401, 500)
@Controller('vehicles')
export class VehiclesController {
  constructor(
    @Inject(VehiclesService) private readonly vehicles: VehiclesService,
  ) {}

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Registrar vehículo (ADMIN)',
    description: 'El estado inicial es AVAILABLE.',
  })
  @ApiSuccess(201, Vehicle)
  @ApiErrors(400, 403, 409)
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @ApiOperation({
    summary: 'Listar vehículos',
    description: 'Permite filtrar por estado.',
  })
  @ApiSuccess(200, Vehicle, true)
  @ApiErrors(400)
  @Get()
  findAll(@Query() query: ListVehiclesDto) {
    return this.vehicles.findAll(query);
  }

  @ApiOperation({ summary: 'Consultar vehículo por placa' })
  @ApiSuccess(200, Vehicle)
  @ApiErrors(404)
  @Get('plate/:plate')
  findByPlate(@Param('plate') plate: string) {
    return this.vehicles.findByPlate(plate);
  }

  @ApiOperation({ summary: 'Consultar vehículo por ID' })
  @ApiSuccess(200, Vehicle)
  @ApiErrors(400, 404)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.findOne(id);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Actualizar vehículo (ADMIN)',
    description:
      'Permite reactivar un vehículo con status AVAILABLE. No permite disminuir el kilometraje ni cambiar manualmente IN_MAINTENANCE.',
  })
  @ApiSuccess(200, Vehicle)
  @ApiErrors(400, 403, 404, 409)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Inactivar vehículo (ADMIN)',
    description:
      'Conserva los datos históricos. No elimina físicamente el registro.',
  })
  @ApiSuccess(200, Vehicle)
  @ApiErrors(400, 403, 404, 409)
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.deactivate(id);
  }
}
