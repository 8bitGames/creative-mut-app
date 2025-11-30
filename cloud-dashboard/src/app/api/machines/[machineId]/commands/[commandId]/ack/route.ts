import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { db } from '@/lib/db';
import { machineCommands } from '@/lib/db/schema';

const ackSchema = z.object({
  status: z.enum(['received', 'completed', 'failed']),
  result: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().max(1000).optional(),
});

interface RouteParams {
  params: Promise<{ machineId: string; commandId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateMachineToken(request);
  if (!authResult.valid) {
    return apiError('UNAUTHORIZED', authResult.error, 401);
  }

  const { machineId, commandId } = await params;
  const { payload } = authResult;

  if (payload.machineId !== machineId) {
    return apiError('FORBIDDEN', 'Machine ID mismatch', 403);
  }

  try {
    const body = await request.json();
    const parsed = ackSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 'Invalid acknowledgment format', 400);
    }

    const { status, result, errorMessage } = parsed.data;

    // Update command status
    const updateData: Record<string, unknown> = { status };

    if (status === 'received') {
      updateData.receivedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
      if (result) updateData.result = result;
      if (errorMessage) updateData.errorMessage = errorMessage;
    }

    const [updated] = await db
      .update(machineCommands)
      .set(updateData)
      .where(and(eq(machineCommands.id, commandId), eq(machineCommands.machineId, machineId)))
      .returning();

    if (!updated) {
      return apiError('NOT_FOUND', 'Command not found', 404);
    }

    return apiSuccess({ acknowledged: true });
  } catch (error) {
    console.error('Command ack error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to acknowledge command', 500);
  }
}
