import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceAudit } from './maintenance-audit.entity.js';

@Injectable()
export class MaintenanceAuditsDao {
  constructor(@InjectRepository(MaintenanceAudit) private readonly repository: Repository<MaintenanceAudit>) {}

  create(data: Pick<MaintenanceAudit, 'maintenanceId' | 'actorId' | 'fromStatus' | 'toStatus'>) {
    return this.repository.save(this.repository.create(data));
  }
  findByMaintenance(maintenanceId: number) {
    return this.repository.find({ where: { maintenanceId }, order: { createdAt: 'ASC', id: 'ASC' } });
  }
}
