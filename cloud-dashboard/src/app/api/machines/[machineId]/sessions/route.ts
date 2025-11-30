import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';

const createSessionSchema = z.object({
  sessionCode: z.string().min(1).max(50),
  frameId: z.string().optional(),
  processingMode: z.string().optional(),
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
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 'Invalid session data', 400);
    }

    const { sessionCode, frameId, processingMode } = parsed.data;

    // Check for duplicate session code
    const [existing] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionCode, sessionCode))
      .limit(1);

    if (existing) {
      return apiError('DUPLICATE_SESSION', 'Session code already exists', 409);
    }

    const [session] = await db
      .insert(sessions)
      .values({
        machineId,
        sessionCode,
        frameId,
        processingMode,
        status: 'started',
      })
      .returning();

    if (!session) {
      return apiError('INTERNAL_ERROR', 'Failed to create session', 500);
    }

    return apiSuccess({
      sessionId: session.id,
      sessionCode: session.sessionCode,
    });
  } catch (error) {
    console.error('Session create error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create session', 500);
  }
}
