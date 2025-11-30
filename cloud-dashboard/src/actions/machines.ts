'use server';

import { and, desc, eq, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { machines } from '@/lib/db/schema';
import { getUserOrganization } from './auth';

export async function getMachines(filters?: { status?: string; location?: string; q?: string }) {
  const org = await getUserOrganization();
  if (!org) return [];

  const conditions = [eq(machines.organizationId, org.id)];

  if (filters?.status) {
    conditions.push(eq(machines.status, filters.status));
  }

  if (filters?.q) {
    conditions.push(like(machines.name, `%${filters.q}%`));
  }

  return db
    .select()
    .from(machines)
    .where(and(...conditions))
    .orderBy(desc(machines.lastHeartbeat));
}

export async function getMachine(id: string) {
  const org = await getUserOrganization();
  if (!org) return null;

  const result = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.organizationId, org.id)))
    .limit(1);

  return result[0] || null;
}

export async function registerMachine(data: {
  hardwareId: string;
  name?: string;
  locationId?: string;
}) {
  const org = await getUserOrganization();
  if (!org) throw new Error('Unauthorized');

  const [machine] = await db
    .insert(machines)
    .values({
      organizationId: org.id,
      hardwareId: data.hardwareId,
      name: data.name,
      locationId: data.locationId,
    })
    .returning();

  revalidatePath('/machines');
  return machine;
}

export async function updateMachine(id: string, data: Partial<typeof machines.$inferInsert>) {
  const org = await getUserOrganization();
  if (!org) throw new Error('Unauthorized');

  const [updated] = await db
    .update(machines)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(machines.id, id), eq(machines.organizationId, org.id)))
    .returning();

  revalidatePath(`/machines/${id}`);
  revalidatePath('/machines');
  return updated;
}

export async function deleteMachine(id: string) {
  const org = await getUserOrganization();
  if (!org) throw new Error('Unauthorized');

  await db.delete(machines).where(and(eq(machines.id, id), eq(machines.organizationId, org.id)));

  revalidatePath('/machines');
}
