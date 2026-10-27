import { MaintenanceAuditsDao } from './maintenance-audits.dao.js';
import { MaintenancesDao } from './maintenances.dao.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Maintenance } from './maintenance.entity.js';
import { MaintenanceAudit } from './maintenance-audit.entity.js';
import { MaintenancesService } from './maintenances.service.js';
import { MaintenancesController } from './maintenances.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Maintenance, MaintenanceAudit])],
  controllers: [MaintenancesController],
  providers: [MaintenancesService, MaintenancesDao, MaintenanceAuditsDao],
})
export class MaintenancesModule {}
