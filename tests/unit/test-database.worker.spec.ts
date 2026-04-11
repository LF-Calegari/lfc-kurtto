import {
  POSTGRES_MAX_IDENTIFIER_LENGTH,
  deriveIntegrationTestDatabaseUrlForWorker,
  extractDatabaseNameFromPostgresUrl,
  replaceDatabaseInPostgresUrl,
  truncatePostgresIdentifier,
} from '@config/test-database';

describe('deriveIntegrationTestDatabaseUrlForWorker', () => {
  const base = 'postgresql://u:p@host.example:5432/kurtto_test';

  it('retorna a URL base quando não há JEST_WORKER_ID', () => {
    expect(deriveIntegrationTestDatabaseUrlForWorker(base, undefined)).toBe(
      base,
    );
    expect(deriveIntegrationTestDatabaseUrlForWorker(base, '')).toBe(base);
    expect(deriveIntegrationTestDatabaseUrlForWorker(base, '   ')).toBe(base);
  });

  it('acrescenta sufixo _w<id> ao nome do banco', () => {
    expect(deriveIntegrationTestDatabaseUrlForWorker(base, '3')).toBe(
      'postgresql://u:p@host.example:5432/kurtto_test_w3',
    );
  });

  it('rejeita URL base vazia', () => {
    expect(() =>
      deriveIntegrationTestDatabaseUrlForWorker('  ', '1'),
    ).toThrow('URL base de teste vazia');
  });

  it('rejeita nome derivado inválido para o banco', () => {
    expect(() =>
      deriveIntegrationTestDatabaseUrlForWorker(base, 'worker-1'),
    ).toThrow('Nome de banco derivado inválido');
  });
});

describe(
  'extractDatabaseNameFromPostgresUrl e replaceDatabaseInPostgresUrl',
  () => {
    it('extrai o nome do path', () => {
      expect(
        extractDatabaseNameFromPostgresUrl(
          'postgresql://localhost:5432/my_db',
        ),
      ).toBe('my_db');
    });

    it('rejeita URL inválida (cenário de configuração)', () => {
      expect(() => extractDatabaseNameFromPostgresUrl('not-a-url')).toThrow(
        'URL de Postgres inválida',
      );
    });

    it('rejeita protocolo diferente de postgres', () => {
      expect(() =>
        extractDatabaseNameFromPostgresUrl(
          'mysql://user:pass@localhost:3306/db',
        ),
      ).toThrow(/esperado postgres/i);
    });

    it('rejeita URL sem nome de banco no path', () => {
      expect(() =>
        extractDatabaseNameFromPostgresUrl('postgresql://localhost:5432'),
      ).toThrow(/sem nome de banco/i);
    });

    it('substitui o banco na URL', () => {
      expect(
        replaceDatabaseInPostgresUrl(
          'postgresql://a:b@x:5432/old',
          'new_db',
        ),
      ).toBe('postgresql://a:b@x:5432/new_db');
    });
  },
);

describe('truncatePostgresIdentifier', () => {
  it('respeita NAMEDATALEN', () => {
    const long = 'a'.repeat(POSTGRES_MAX_IDENTIFIER_LENGTH + 10);
    expect(truncatePostgresIdentifier(long).length).toBe(
      POSTGRES_MAX_IDENTIFIER_LENGTH,
    );
  });
});
