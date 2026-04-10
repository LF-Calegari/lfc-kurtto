import { createAppDataSource } from '@config/data-source';
import { env } from '@config/env';

type PgLikeOptions = {
  type: string;
  url?: string;
  host?: string;
  username?: string;
};

describe('createAppDataSource', () => {
  it('uses url mode for postgres URL override', () => {
    const url = 'postgresql://u:p@db.example:5432/mydb';
    const ds = createAppDataSource({ databaseUrlOverride: url });
    const opts = ds.options as PgLikeOptions;

    expect(opts.type).toBe('postgres');
    expect(opts.url).toBe(url);
  });

  it('uses host mode when URL override empty', () => {
    const originalUser = process.env.POSTGRES_USER;
    process.env.POSTGRES_USER = 'from_postgres_env';

    try {
      const ds = createAppDataSource({ databaseUrlOverride: '' });
      const opts = ds.options as PgLikeOptions;

      expect(opts.type).toBe('postgres');
      expect(opts.url).toBeUndefined();
      expect(opts.host).toBe(env.DB_HOST);
      expect(opts.username).toBe('from_postgres_env');
    } finally {
      if (originalUser === undefined) {
        delete process.env.POSTGRES_USER;
      } else {
        process.env.POSTGRES_USER = originalUser;
      }
    }
  });
});
