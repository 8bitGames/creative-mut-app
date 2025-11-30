'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { CommandType } from '@/lib/commands/types';
import { db } from '@/lib/db';
import { machineCommands, machines } from '@/lib/db/schema';
import { getUser, getUserOrganization } from './auth';

export async function sendCommand(
  machineId: string,
  type: CommandType,
  payload?: Record<string, unknown>
) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Verify machine belongs to org
  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) throw new Error('Machine not found');

  // Create command
  const [command] = await db
    .insert(machineCommands)
    .values({
      machineId,
      type,
      payload: payload || {},
      status: 'pending',
      createdBy: user.id,
    })
    .returning();

  revalidatePath(`/machines/${machineId}`);
  revalidatePath(`/machines/${machineId}/settings`);

  return command;
}

export async function getCommandHistory(machineId: string, limit = 20) {
  const org = await getUserOrganization();
  if (!org) return [];

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) return [];

  return db
    .select()
    .from(machineCommands)
    .where(eq(machineCommands.machineId, machineId))
    .orderBy(desc(machineCommands.createdAt))
    .limit(limit);
}

export async function updateCommandStatus(
  commandId: string,
  status: string,
  result?: Record<string, unknown>,
  errorMessage?: string
) {
  const now = new Date();

  const updates: Record<string, unknown> = { status };

  if (status === 'sent') {
    updates.sentAt = now;
  } else if (status === 'received') {
    updates.receivedAt = now;
  } else if (['completed', 'failed', 'timeout'].includes(status)) {
    updates.completedAt = now;
    if (result) updates.result = result;
    if (errorMessage) updates.errorMessage = errorMessage;
  }

  await db.update(machineCommands).set(updates).where(eq(machineCommands.id, commandId));
}

// Bulk command to multiple machines
export async function sendBulkCommand(
  machineIds: string[],
  type: CommandType,
  payload?: Record<string, unknown>
) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Verify all machines belong to org
  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const validMachineIds = orgMachines.map((m) => m.id);
  const invalidIds = machineIds.filter((id) => !validMachineIds.includes(id));

  if (invalidIds.length > 0) {
    throw new Error(`Invalid machine IDs: ${invalidIds.join(', ')}`);
  }

  // Create commands for all machines
  const commands = await db
    .insert(machineCommands)
    .values(
      machineIds.map((machineId) => ({
        machineId,
        type,
        payload: payload || {},
        status: 'pending',
        createdBy: user.id,
      }))
    )
    .returning();

  machineIds.forEach((id) => revalidatePath(`/machines/${id}`));

  return commands;
}
