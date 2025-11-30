'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { type MachineConfigData, machineConfigSchema } from '@/lib/config/schema';
import { db } from '@/lib/db';
import { machineConfigs, machines } from '@/lib/db/schema';
import { getUser, getUserOrganization } from './auth';

export async function getConfig(machineId: string) {
  const org = await getUserOrganization();
  if (!org) return null;

  // Verify machine belongs to org
  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) return null;

  const [config] = await db
    .select()
    .from(machineConfigs)
    .where(and(eq(machineConfigs.machineId, machineId), eq(machineConfigs.isActive, true)))
    .limit(1);

  return config;
}

export async function getConfigHistory(machineId: string) {
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
    .from(machineConfigs)
    .where(eq(machineConfigs.machineId, machineId))
    .orderBy(desc(machineConfigs.createdAt))
    .limit(20);
}

export async function saveConfig(machineId: string, config: MachineConfigData) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Validate config
  const validatedConfig = machineConfigSchema.parse(config);

  // Verify machine
  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) throw new Error('Machine not found');

  // Generate version
  const version = `v${Date.now()}`;

  // Deactivate current config
  await db
    .update(machineConfigs)
    .set({ isActive: false })
    .where(and(eq(machineConfigs.machineId, machineId), eq(machineConfigs.isActive, true)));

  // Create new config
  const [newConfig] = await db
    .insert(machineConfigs)
    .values({
      machineId,
      version,
      config: validatedConfig,
      isActive: true,
      createdBy: user.id,
    })
    .returning();

  // Update machine config version
  await db
    .update(machines)
    .set({ configVersion: version, updatedAt: new Date() })
    .where(eq(machines.id, machineId));

  revalidatePath(`/machines/${machineId}`);
  revalidatePath(`/machines/${machineId}/settings`);

  return newConfig;
}

export async function rollbackConfig(machineId: string, version: string) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) throw new Error('Machine not found');

  // Find the config to rollback to
  const [targetConfig] = await db
    .select()
    .from(machineConfigs)
    .where(and(eq(machineConfigs.machineId, machineId), eq(machineConfigs.version, version)))
    .limit(1);

  if (!targetConfig) throw new Error('Config version not found');

  // Deactivate current
  await db
    .update(machineConfigs)
    .set({ isActive: false })
    .where(and(eq(machineConfigs.machineId, machineId), eq(machineConfigs.isActive, true)));

  // Create new version with old config
  const newVersion = `v${Date.now()}-rollback`;

  const [newConfig] = await db
    .insert(machineConfigs)
    .values({
      machineId,
      version: newVersion,
      config: targetConfig.config,
      isActive: true,
      createdBy: user.id,
    })
    .returning();

  // Update machine
  await db
    .update(machines)
    .set({ configVersion: newVersion, updatedAt: new Date() })
    .where(eq(machines.id, machineId));

  revalidatePath(`/machines/${machineId}`);
  revalidatePath(`/machines/${machineId}/settings`);

  return newConfig;
}
