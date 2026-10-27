import { hashPassword, verifyPassword } from './password.js';

describe('Hashing de contraseñas', () => {
  it('usa una sal distinta para la misma contraseña y verifica el resultado', async () => {
    const first = await hashPassword('ClaveSegura123!');
    const second = await hashPassword('ClaveSegura123!');
    expect(first).not.toBe(second);
    expect(first).not.toContain('ClaveSegura123!');
    expect(await verifyPassword(first, 'ClaveSegura123!')).toBe(true);
    expect(await verifyPassword(first, 'incorrecta')).toBe(false);
  });

  it('rechaza hashes corruptos o formatos incompatibles sin lanzar errores', async () => {
    for (const stored of ['', 'scrypt$invalid$hash', 'otro$tipo$hash']) {
      expect(await verifyPassword(stored, 'clave')).toBe(false);
    }
  });
});
