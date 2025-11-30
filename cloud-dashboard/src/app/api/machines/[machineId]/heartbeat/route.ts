import { and, desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { db } from '@/lib/db';
import { machineConfigs, machines } from '@/lib/db/schema';

const peripheralStatusSchema = z.object({
  camera: z.enum(['ok', 'error', 'offline']).optional(),
  printer: z.enum(['ok', 'error', 'offline', 'paper_low']).optional(),
  cardReader: z.enum(['ok', 'error', 'offline']).optional(),
});

const metricsSchema = z.object({
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  diskUsage: z.number().min(0).max(100).optional(),
  sessionsToday: z.number().min(0).optional(),
});

const heartbeatSchema = z.object({
  status: z.enum(['online', 'busy', 'error']),
  configVersion: z.string().optional(),
  uptime: z.number().optional(),
  peripheralStatus: peripheralStatusSchema.optional(),
  metrics: metricsSchema.optional(),
});

interface RouteParams {
  params: Promise<{ machineId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateMachineToken(request);
  if (!authResult.valid) {
    return apiError('UNAUTHORIZED', authResult.error, 401);
  }

  const { machineId } = await params;
  const { payload } = authResult;

  if (payload.machineId !== machineId) {
    return apiError('FORBIDDEN', 'Machine ID mismatch', 403);
  }

  try {
    const body = await request.json();
    const parsed = heartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 'Invalid heartbeat data', 400);
    }

    const { status, configVersion, peripheralStatus } = parsed.data;

    // Update machine status
    await db
      .update(machines)
      .set({
        status,
        lastHeartbeat: new Date(),
        peripheralStatus: peripheralStatus || {},
        configVersion: configVersion || null,
        updatedAt: new Date(),
      })
      .where(eq(machines.id, machineId));

    // Check if config update is available
    let configUpdateAvailable = false;
    if (configVersion) {
      const [latestConfig] = await db
        .select({ version: machineConfigs.version })
        .from(machineConfigs)
        .where(and(eq(machineConfigs.machineId, machineId), eq(machineConfigs.isActive, true)))
        .orderBy(desc(machineConfigs.createdAt))
        .limit(1);

      if (latestConfig && latestConfig.version !== configVersion) {
        configUpdateAvailable = true;
      }
    }

    return apiSuccess({
      acknowledged: true,
      serverTime: new Date().toISOString(),
      configUpdateAvailable,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process heartbeat', 500);
  }
}
