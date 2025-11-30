import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateMachineToken } from '@/lib/api/middleware';
import { db } from '@/lib/db';
import { machineLogs } from '@/lib/db/schema';

const MAX_LOGS_PER_REQUEST = 100;
const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

interface LogEntry {
  level: string;
  category?: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface LogsRequestBody {
  logs: LogEntry[];
}

function validateLogs(
  body: unknown
): { valid: true; data: LogsRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const reqBody = body as Record<string, unknown>;
  if (!Array.isArray(reqBody.logs)) {
    return { valid: false, error: 'logs must be an array' };
  }

  if (reqBody.logs.length > MAX_LOGS_PER_REQUEST) {
    return { valid: false, error: `Maximum ${MAX_LOGS_PER_REQUEST} logs per request` };
  }

  for (const log of reqBody.logs) {
    if (!log || typeof log !== 'object') {
      return { valid: false, error: 'Each log entry must be an object' };
    }
    const entry = log as Record<string, unknown>;
    if (!VALID_LOG_LEVELS.includes(entry.level as (typeof VALID_LOG_LEVELS)[number])) {
      return { valid: false, error: 'Invalid log level' };
    }
    if (typeof entry.message !== 'string') {
      return { valid: false, error: 'Log message must be a string' };
    }
    if (typeof entry.timestamp !== 'string') {
      return { valid: false, error: 'Log timestamp must be a string' };
    }
  }

  return { valid: true, data: { logs: reqBody.logs } as LogsRequestBody };
}

interface RouteParams {
  params: Promise<{ machineId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

  try {
    const body = await request.json();
    const parsed = validateLogs(body);

    if (!parsed.valid) {
      return apiError('INVALID_REQUEST', parsed.error, 400);
    }

    const { logs } = parsed.data;

    if (logs.length === 0) {
      return apiSuccess({ received: 0, dropped: 0 });
    }

    // Prepare log entries for insertion
    const logEntries = logs.map((log) => ({
      machineId,
      level: log.level as 'debug' | 'info' | 'warn' | 'error',
      category: log.category || 'general',
      message: log.message,
      metadata: log.metadata || {},
      timestamp: new Date(log.timestamp),
    }));

    // Batch insert
    await db.insert(machineLogs).values(logEntries);

    return apiSuccess({
      received: logEntries.length,
      dropped: 0,
    });
  } catch (error) {
    console.error('Log ingestion error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to store logs', 500);
  }
}
