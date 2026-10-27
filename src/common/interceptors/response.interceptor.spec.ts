import type { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor.js';

const context = {
  switchToHttp: () => ({ getRequest: () => ({ path: '/vehicles' }), getResponse: () => ({ statusCode: 201 }) }),
} as unknown as ExecutionContext;

describe('ResponseInterceptor', () => {
  it('conserva el código HTTP y los datos con fecha válida', async () => {
    const data = { id: 1, plate: 'ABC123' };
    const result = await lastValueFrom(new ResponseInterceptor().intercept(context, { handle: () => of(data) })) as { timestamp: string };
    expect(result).toMatchObject({ success: true, statusCode: 201, data, path: '/vehicles' });
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it.each([undefined, null])('normaliza respuestas sin datos a null: %s', async (data) => {
    const result = await lastValueFrom(new ResponseInterceptor().intercept(context, { handle: () => of(data) }));
    expect(result).toMatchObject({ data: null });
  });

  it('deja los errores al filtro sin convertirlos en respuestas exitosas', async () => {
    const failure = new Error('conflicto');
    await expect(lastValueFrom(new ResponseInterceptor().intercept(context, { handle: () => throwError(() => failure) }))).rejects.toBe(failure);
  });
});
