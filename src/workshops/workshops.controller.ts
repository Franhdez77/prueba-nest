import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/role.enum.js';
import { ApiErrors, ApiSuccess } from '../docs/api-responses.decorator.js';
import { Workshop } from './workshop.entity.js';
import { WorkshopsService } from './workshops.service.js';
import { CreateWorkshopDto } from './dto/create-workshop.dto.js';
import { UpdateWorkshopStatusDto } from './dto/update-workshop-status.dto.js';

@ApiTags('Talleres')
@ApiBearerAuth()
@ApiErrors(401, 500)
@Controller('workshops')
export class WorkshopsController {
  constructor(
    @Inject(WorkshopsService) private readonly workshops: WorkshopsService,
  ) {}

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Registrar taller (ADMIN)', description: 'Estado inicial ACTIVE.' })
  @ApiSuccess(201, Workshop)
  @ApiErrors(400, 403)
  @Post()
  create(@Body() dto: CreateWorkshopDto) {
    return this.workshops.create(dto);
  }

  @ApiOperation({ summary: 'Listar talleres activos' })
  @ApiSuccess(200, Workshop, true)
  @Get()
  findActive() {
    return this.workshops.findActive();
  }

  @ApiOperation({ summary: 'Consultar taller por ID', description: 'Permite consultar talleres activos e inactivos.' })
  @ApiSuccess(200, Workshop)
  @ApiErrors(400, 404)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workshops.findOne(id);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activar o inactivar taller (ADMIN)', description: 'Conserva el registro y sus relaciones históricas.' })
  @ApiSuccess(200, Workshop)
  @ApiErrors(400, 403, 404)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkshopStatusDto,
  ) {
    return this.workshops.updateStatus(id, dto.status);
  }
}
