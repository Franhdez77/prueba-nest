import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/role.enum.js';
import { ApiErrors, ApiSuccess } from '../docs/api-responses.decorator.js';
import { Mechanic } from './mechanic.entity.js';
import { MechanicsService } from './mechanics.service.js';
import { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import { ListMechanicsDto } from './dto/list-mechanics.dto.js';

@ApiTags('Mecánicos')
@ApiBearerAuth()
@ApiErrors(401, 500)
@Controller('mechanics')
export class MechanicsController {
  constructor(
    @Inject(MechanicsService) private readonly mechanics: MechanicsService,
  ) {}

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Registrar mecánico (ADMIN)',
    description:
      'Estado inicial ACTIVE. La vinculación con un usuario TECHNICIAN es opcional y única.',
  })
  @ApiSuccess(201, Mechanic)
  @ApiErrors(400, 403, 404, 409)
  @Post()
  create(@Body() dto: CreateMechanicDto) {
    return this.mechanics.create(dto);
  }

  @ApiOperation({
    summary: 'Listar mecánicos',
    description: 'Permite filtrar por ACTIVE o INACTIVE.',
  })
  @ApiSuccess(200, Mechanic, true)
  @ApiErrors(400)
  @Get()
  findAll(@Query() query: ListMechanicsDto) {
    return this.mechanics.findAll(query);
  }

  @ApiOperation({ summary: 'Consultar mecánico por ID' })
  @ApiSuccess(200, Mechanic)
  @ApiErrors(400, 404)
  @Get(':id')
  findOne(@Param('id', ParseIdPipe) id: number) {
    return this.mechanics.findOne(id);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Actualizar o activar mecánico (ADMIN)',
    description:
      'Usa status ACTIVE para activar. userId null permite desvincular al usuario. No existe vínculo permanente con talleres.',
  })
  @ApiSuccess(200, Mechanic)
  @ApiErrors(400, 403, 404, 409)
  @Patch(':id')
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateMechanicDto,
  ) {
    return this.mechanics.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Inactivar mecánico (ADMIN)',
    description: 'Conserva sus datos y relaciones históricas.',
  })
  @ApiSuccess(200, Mechanic)
  @ApiErrors(400, 403, 404)
  @Delete(':id')
  deactivate(@Param('id', ParseIdPipe) id: number) {
    return this.mechanics.deactivate(id);
  }
}
