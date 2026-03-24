import { describe, it, expect } from 'vitest';
import { getGravatarUrl } from './db';

describe('getGravatarUrl', () => {
  it('should generate a correct Gravatar URL for a given email', async () => {
    // SHA-256 hash for 'test@example.com'
    const url = await getGravatarUrl('test@example.com');
    expect(url).toBe('https://www.gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b?d=identicon&s=200');
  });

  it('should trim and lowercase the email before hashing', async () => {
    const url1 = await getGravatarUrl('test@example.com');
    const url2 = await getGravatarUrl('  TEST@example.com ');
    expect(url1).toBe(url2);
  });
});
