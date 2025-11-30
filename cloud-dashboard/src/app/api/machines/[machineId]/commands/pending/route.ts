import { and, asc, eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { db } from '@/lib/db';
import { machineCommands } from '@/lib/db/schema';

interface RouteParams {
  params: Promise<{ machineId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    // Get pending commands (not yet sent or received)
    const commands = await db
      .select({
        id: machineCommands.id,
        type: machineCommands.type,
        payload: machineCommands.payload,
        createdAt: machineCommands.createdAt,
      })
      .from(machineCommands)
      .where(
        and(
          eq(machineCommands.machineId, machineId),
          inArray(machineCommands.status, ['pending', 'sent'])
        )
      )
      .orderBy(asc(machineCommands.createdAt))
      .limit(10);

    // Mark as sent
    if (commands.length > 0) {
      const commandIds = commands.map((c) => c.id);
      await db
        .update(machineCommands)
        .set({ status: 'sent', sentAt: new Date() })
        .where(inArray(machineCommands.id, commandIds));
    }

    return apiSuccess({
      commands: commands.map((c) => ({
        id: c.id,
        type: c.type,
        payload: c.payload || {},
        createdAt: c.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Command fetch error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch commands', 500);
  }
}
