import { validateEnv } from './env.validation';

const VALID = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'cinema',
  DB_PASSWORD: 'cinema',
  DB_NAME: 'cinema',
};

describe('validateEnv', () => {
  it('converts and returns a valid configuration with defaults', () => {
    const env = validateEnv({ ...VALID });
    expect(env).toMatchObject({
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      PORT: 3000,
      DB_LOGGING: false,
    });
    expect(
      validateEnv({ ...VALID, PORT: '8080', DB_LOGGING: 'true' }),
    ).toMatchObject({ PORT: 8080, DB_LOGGING: true });
  });

  it.each(Object.keys(VALID))('refuses to start without %s', (key) => {
    const env: Record<string, unknown> = { ...VALID };
    delete env[key];
    expect(() => validateEnv(env)).toThrow(`${key} is required`);
  });

  it('rejects invalid values', () => {
    expect(() => validateEnv({ ...VALID, DB_PORT: 'abc' })).toThrow('DB_PORT');
    expect(() => validateEnv({ ...VALID, DB_PORT: '70000' })).toThrow(
      'DB_PORT',
    );
    expect(() => validateEnv({ ...VALID, DB_HOST: '' })).toThrow('DB_HOST');
    expect(() => validateEnv({ ...VALID, PORT: '3.5' })).toThrow('PORT');
    expect(() => validateEnv({ ...VALID, DB_LOGGING: 'yes' })).toThrow(
      'DB_LOGGING',
    );
  });
});
