import { and, desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { defaultMachineConfig, machineConfigSchema } from '@/lib/config/schema';
import { db } from '@/lib/db';
import { machineConfigs } from '@/lib/db/schema';

interface RouteParams {
  params: Promise<{ machineId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Validate token
  const authResult = await validateMachineToken(request);
  if (!authResult.valid) {
    return apiError('UNAUTHORIZED', authResult.error, 401);
  }

  const { machineId } = await params;
  const { payload } = authResult;

  // Verify machine ID matches token
  if (payload.machineId !== machineId) {
    return apiError('FORBIDDEN', 'Machine ID mismatch', 403);
  }

  // Get current version from query
  const url = new URL(request.url);
  const currentVersion = url.searchParams.get('currentVersion');

  try {
    // Get active config for machine
    const [config] = await db
      .select()
      .from(machineConfigs)
      .where(and(eq(machineConfigs.machineId, machineId), eq(machineConfigs.isActive, true)))
      .orderBy(desc(machineConfigs.createdAt))
      .limit(1);

    // If no config exists, return default
    if (!config) {
      return apiSuccess({
        version: 'default',
        config: defaultMachineConfig,
        changed: currentVersion !== 'default',
        updatedAt: new Date().toISOString(),
      });
    }

    // Check if version changed
    const changed = currentVersion !== config.version;

    if (!changed) {
      return apiSuccess({
        version: config.version,
        changed: false,
      });
    }

    // Return full config
    const parsedConfig = machineConfigSchema.parse(config.config);

    return apiSuccess({
      version: config.version,
      config: parsedConfig,
      changed: true,
      updatedAt: config.createdAt?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Config fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch config', 500);
  }
}
