import { BadRequestException, ConflictException } from '@nestjs/common';
import { MaintenanceStatus } from './maintenance.enums.js';
import type { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';

export function assertTransition(from: MaintenanceStatus, to: MaintenanceStatus) {
  const allowed: Record<MaintenanceStatus, MaintenanceStatus[]> = {
    [MaintenanceStatus.SCHEDULED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED],
    [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.COMPLETED],
    [MaintenanceStatus.COMPLETED]: [],
    [MaintenanceStatus.CANCELLED]: [],
  };
  if (!allowed[from].includes(to)) {
    throw new ConflictException(`No se permite cambiar de ${from} a ${to}`);
  }
}

export function scheduleInterval(start: string, end: string) {
  const scheduledStart = new Date(start);
  const scheduledEnd = new Date(end);
  if (!Number.isFinite(scheduledStart.getTime()) || !Number.isFinite(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) {
    throw new BadRequestException('La fecha y hora de fin deben ser posteriores al inicio');
  }
  return { scheduledStart, scheduledEnd };
}

export function closingData(dto: UpdateMaintenanceStatusDto, minimumMileage: number, startedAt: Date | null) {
  if (!dto.workPerformed?.trim() || dto.finalCost === undefined || dto.finishedAt === undefined || dto.finalMileage === undefined) {
    throw new BadRequestException('Para completar se requiere trabajo realizado, costo, fecha y kilometraje final');
  }
  if (dto.finalMileage < minimumMileage) {
    throw new ConflictException('El kilometraje final no puede ser inferior al del vehículo o al registrado en el mantenimiento');
  }
  const finishedAt = new Date(dto.finishedAt);
  if (!Number.isFinite(finishedAt.getTime()) || !startedAt || finishedAt < startedAt) {
    throw new ConflictException('La fecha de finalización no puede ser anterior al inicio real');
  }
  return {
    workPerformed: dto.workPerformed.trim(),
    finalCost: dto.finalCost.toFixed(2),
    finishedAt,
    finalMileage: dto.finalMileage,
  };
}
