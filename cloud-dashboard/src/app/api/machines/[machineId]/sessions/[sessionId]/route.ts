import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';

const updateSessionSchema = z.object({
  status: z.enum(['started', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  processingTimeMs: z.number().optional(),
  deliveryMethod: z.string().optional(),
  paymentAmount: z.number().optional(),
  currency: z.string().length(3).optional(),
  processedVideoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  qrCodeUrl: z.string().url().optional(),
  rawImagesUrl: z.array(z.string()).optional(),
  frameImagesUrl: z.array(z.string()).optional(),
  errorMessage: z.string().max(1000).optional(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),

  // TL3600 Payment Details
  approvalNumber: z.string().max(50).optional(),
  salesDate: z
    .string()
    .regex(/^\d{8}$/)
    .optional(), // YYYYMMDD
  salesTime: z
    .string()
    .regex(/^\d{6}$/)
    .optional(), // HHMMSS
  transactionMedia: z.enum(['ic', 'rf', 'ms']).optional(),
  cardNumber: z.string().max(20).optional(), // Masked: ****1234
});

interface RouteParams {
  params: Promise<{ machineId: string; sessionId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateMachineToken(request);
  if (!authResult.valid) {
    return apiError('UNAUTHORIZED', authResult.error, 401);
  }

  const { machineId, sessionId } = await params;
  const { payload } = authResult;

  if (payload.machineId !== machineId) {
    return apiError('FORBIDDEN', 'Machine ID mismatch', 403);
  }

  try {
    const body = await request.json();
    const parsed = updateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 'Invalid update data', 400);
    }

    const updateData: Record<string, unknown> = {};

    // Map fields (use !== undefined to allow 0 values for numeric fields)
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.processingTimeMs !== undefined)
      updateData.processingTimeMs = parsed.data.processingTimeMs;
    if (parsed.data.deliveryMethod !== undefined)
      updateData.deliveryMethod = parsed.data.deliveryMethod;
    if (parsed.data.paymentAmount !== undefined)
      updateData.paymentAmount = String(parsed.data.paymentAmount);
    if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;
    if (parsed.data.processedVideoUrl !== undefined)
      updateData.processedVideoUrl = parsed.data.processedVideoUrl;
    if (parsed.data.thumbnailUrl !== undefined) updateData.thumbnailUrl = parsed.data.thumbnailUrl;
    if (parsed.data.qrCodeUrl !== undefined) updateData.qrCodeUrl = parsed.data.qrCodeUrl;
    if (parsed.data.rawImagesUrl !== undefined) updateData.rawImagesUrl = parsed.data.rawImagesUrl;
    if (parsed.data.frameImagesUrl !== undefined)
      updateData.frameImagesUrl = parsed.data.frameImagesUrl;
    if (parsed.data.errorMessage !== undefined) updateData.errorMessage = parsed.data.errorMessage;
    if (parsed.data.completedAt !== undefined)
      updateData.completedAt = new Date(parsed.data.completedAt);
    if (parsed.data.metadata !== undefined) updateData.metadata = parsed.data.metadata;

    // TL3600 Payment Details
    if (parsed.data.approvalNumber !== undefined)
      updateData.approvalNumber = parsed.data.approvalNumber;
    if (parsed.data.salesDate !== undefined) updateData.salesDate = parsed.data.salesDate;
    if (parsed.data.salesTime !== undefined) updateData.salesTime = parsed.data.salesTime;
    if (parsed.data.transactionMedia !== undefined)
      updateData.transactionMedia = parsed.data.transactionMedia;
    if (parsed.data.cardNumber !== undefined) updateData.cardNumber = parsed.data.cardNumber;

    const [updated] = await db
      .update(sessions)
      .set(updateData)
      .where(and(eq(sessions.id, sessionId), eq(sessions.machineId, machineId)))
      .returning();

    if (!updated) {
      return apiError('NOT_FOUND', 'Session not found', 404);
    }

    return apiSuccess({
      sessionId: updated.id,
      updated: true,
    });
  } catch (error) {
    console.error('Session update error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update session', 500);
  }
}
