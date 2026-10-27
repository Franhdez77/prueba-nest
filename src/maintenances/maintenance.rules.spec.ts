import { assertTransition, closingData, scheduleInterval } from './maintenance.rules.js';
import { MaintenanceStatus as Status } from './maintenance.enums.js';

describe('Reglas de mantenimiento', () => {
  it.each<[Status, Status]>([
    [Status.SCHEDULED, Status.IN_PROGRESS],
    [Status.SCHEDULED, Status.CANCELLED],
    [Status.IN_PROGRESS, Status.COMPLETED],
  ])('permite %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each<[Status, Status]>([
    [Status.SCHEDULED, Status.COMPLETED],
    [Status.IN_PROGRESS, Status.CANCELLED],
    [Status.IN_PROGRESS, Status.SCHEDULED],
    ...[Status.COMPLETED, Status.CANCELLED].flatMap(from => Object.values(Status).map(to => [from, to] as [Status, Status])),
  ])('rechaza %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow('No se permite cambiar');
  });

  it('interpreta zonas horarias y rechaza intervalos vacíos o invertidos', () => {
    expect(scheduleInterval('2026-11-01T07:30:00-05:00', '2026-11-01T09:00:00-05:00').scheduledStart.toISOString()).toBe('2026-11-01T12:30:00.000Z');
    expect(() => scheduleInterval('2026-11-01T12:00:00Z', '2026-11-01T12:00:00Z')).toThrow();
    expect(() => scheduleInterval('2026-11-01T13:00:00Z', '2026-11-01T12:00:00Z')).toThrow();
  });

  it('exige datos de cierre, kilometraje suficiente y una fecha posterior al inicio', () => {
    const started = new Date('2026-11-01T12:00:00Z');
    const dto = { status: Status.COMPLETED, workPerformed: 'Cambio de filtros', finalCost: 0, finishedAt: '2026-11-01T13:00:00Z', finalMileage: 45100 };
    expect(closingData(dto, 45000, started)).toMatchObject({ finalCost: '0.00', finalMileage: 45100 });
    expect(() => closingData({ status: Status.COMPLETED }, 45000, started)).toThrow();
    expect(() => closingData({ ...dto, finalMileage: 44999 }, 45000, started)).toThrow();
    expect(() => closingData({ ...dto, finishedAt: '2026-11-01T11:59:00Z' }, 45000, started)).toThrow();
  });
});
