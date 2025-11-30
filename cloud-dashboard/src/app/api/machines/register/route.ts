import { and, desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { hashApiKey } from '@/lib/api/keys';
import { apiError, apiSuccess } from '@/lib/api/middleware';
import { generateMachineToken } from '@/lib/api/tokens';
import { defaultMachineConfig, machineConfigSchema } from '@/lib/config/schema';
import { db } from '@/lib/db';
import { apiKeys, machineConfigs, machines } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hardwareId, apiKey, name, hardwareInfo } = body;

    // Validate required fields
    if (!hardwareId || !apiKey) {
      return apiError('MISSING_FIELDS', 'hardwareId and apiKey are required');
    }

    // Verify API key
    const keyHash = hashApiKey(apiKey);
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!keyRecord) {
      return apiError('INVALID_API_KEY', 'API key is invalid or inactive', 401);
    }

    // Check if machine already exists
    let [machine] = await db
      .select()
      .from(machines)
      .where(eq(machines.hardwareId, hardwareId))
      .limit(1);

    if (machine) {
      // Verify organization matches
      if (machine.organizationId !== keyRecord.organizationId) {
        return apiError('ORG_MISMATCH', 'Machine registered to different organization', 403);
      }

      // Update existing machine
      const [updatedMachine] = await db
        .update(machines)
        .set({
          lastHeartbeat: new Date(),
          status: 'online',
          hardwareInfo: hardwareInfo || machine.hardwareInfo,
          updatedAt: new Date(),
        })
        .where(eq(machines.id, machine.id))
        .returning();

      if (!updatedMachine) {
        return apiError('INTERNAL_ERROR', 'Failed to update machine', 500);
      }
      machine = updatedMachine;
    } else {
      // Register new machine
      const [newMachine] = await db
        .insert(machines)
        .values({
          organizationId: keyRecord.organizationId,
          hardwareId,
          name: name || `Machine ${hardwareId.substring(0, 8)}`,
          status: 'online',
          lastHeartbeat: new Date(),
          hardwareInfo: hardwareInfo || {},
        })
        .returning();

      if (!newMachine) {
        return apiError('INTERNAL_ERROR', 'Failed to register machine', 500);
      }
      machine = newMachine;
    }

    // Update API key last used
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id));

    // Generate machine token
    const token = generateMachineToken({
      machineId: machine.id,
      organizationId: machine.organizationId,
      hardwareId: machine.hardwareId,
    });

    // Get current config
    const [configData] = await db
      .select()
      .from(machineConfigs)
      .where(and(eq(machineConfigs.machineId, machine.id), eq(machineConfigs.isActive, true)))
      .orderBy(desc(machineConfigs.createdAt))
      .limit(1);

    const config = configData?.config
      ? machineConfigSchema.parse(configData.config)
      : defaultMachineConfig;

    return apiSuccess({
      machineId: machine.id,
      machineToken: token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      config,
    });
  } catch (error) {
    console.error('Machine registration error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to register machine', 500);
  }
}
