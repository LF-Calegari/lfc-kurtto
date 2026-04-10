import { generateShortCode } from '@utils/shortCode';

describe('generateShortCode', () => {
  it('uses default length from env (7 in test)', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('respects explicit length', () => {
    expect(generateShortCode(4)).toHaveLength(4);
    expect(generateShortCode(10)).toHaveLength(10);
  });
});
