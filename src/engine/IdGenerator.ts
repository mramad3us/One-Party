import type { EntityId } from '@/types';

/** Generates a unique entity ID using crypto.randomUUID(). */
export function generateId(): EntityId {
  return crypto.randomUUID();
}
