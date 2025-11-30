import { createHash, randomBytes } from 'node:crypto';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `mut_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 10);
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
