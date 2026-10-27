import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '../users/role.enum.js';
import type { PublicUser } from '../users/user.entity.js';
import { ApiErrors, ApiSuccess } from '../docs/api-responses.decorator.js';
import { Maintenance } from './maintenance.entity.js';
import { MaintenanceAudit } from './maintenance-audit.entity.js';
import { MaintenancesService } from './maintenances.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import { ListMaintenancesDto } from './dto/list-maintenances.dto.js';

@ApiTags('Mantenimientos')
@ApiBearerAuth()
@ApiErrors(401, 500)
@Controller('maintenances')
export class MaintenancesController {
  constructor(@Inject(MaintenancesService) private readonly maintenances: MaintenancesService) {}

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Programar mantenimiento (ADMIN)', description: 'Valida recursos activos, kilometraje y horarios sin cruces. Estado inicial SCHEDULED.' })
  @ApiSuccess(201, Maintenance)
  @ApiErrors(400, 403, 404, 409)
  @Post()
  create(@Body() dto: CreateMaintenanceDto, @CurrentUser() user: PublicUser) {
    return this.maintenances.create(dto, user);
  }

  @ApiOperation({ summary: 'Consultar mantenimientos', description: 'ADMIN consulta todos; TECHNICIAN solo sus asignaciones. Incluye información de vehículo, mecánico y taller.' })
  @ApiSuccess(200, Maintenance, true)
  @ApiErrors(400)
  @Get()
  findAll(@Query() query: ListMaintenancesDto, @CurrentUser() user: PublicUser) {
    return this.maintenances.findAll(query, user);
  }

  @Roles(Role.TECHNICIAN)
  @ApiOperation({ summary: 'Consultar mis mantenimientos asignados' })
  @ApiSuccess(200, Maintenance, true)
  @ApiErrors(400, 403)
  @Get('mine')
  mine(@Query() query: ListMaintenancesDto, @CurrentUser() user: PublicUser) {
    return this.maintenances.findAll(query, user);
  }

  @ApiOperation({ summary: 'Consultar historial de un vehículo', description: 'Incluye todos los estados; el técnico solo ve sus intervenciones.' })
  @ApiSuccess(200, Maintenance, true)
  @ApiErrors(400, 404)
  @Get('vehicle/:vehicleId/history')
  history(@Param('vehicleId', ParseUUIDPipe) vehicleId: string, @CurrentUser() user: PublicUser) {
    return this.maintenances.history(vehicleId, user);
  }

  @ApiOperation({ summary: 'Consultar mantenimientos de un mecánico' })
  @ApiSuccess(200, Maintenance, true)
  @ApiErrors(400, 403, 404)
  @Get('mechanic/:mechanicId')
  byMechanic(@Param('mechanicId', ParseUUIDPipe) mechanicId: string, @CurrentUser() user: PublicUser) {
    return this.maintenances.byMechanic(mechanicId, user);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Consultar auditoría del mantenimiento (ADMIN)' })
  @ApiSuccess(200, MaintenanceAudit, true)
  @ApiErrors(400, 403, 404)
  @Get(':id/audits')
  audits(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.maintenances.audits(id, user);
  }

  @ApiOperation({ summary: 'Consultar mantenimiento por ID' })
  @ApiSuccess(200, Maintenance)
  @ApiErrors(400, 403, 404)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.maintenances.findOne(id, user);
  }

  @ApiOperation({ summary: 'Cambiar estado del mantenimiento', description: 'ADMIN o técnico asignado. SCHEDULED → IN_PROGRESS o CANCELLED; IN_PROGRESS → COMPLETED. No se permite cancelar en proceso. COMPLETED y CANCELLED son definitivos. Para completar se requieren los cuatro campos de cierre.' })
  @ApiSuccess(200, Maintenance)
  @ApiErrors(400, 403, 404, 409)
  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMaintenanceStatusDto, @CurrentUser() user: PublicUser) {
    return this.maintenances.updateStatus(id, dto, user);
  }
}
