'use server';

import { subDays } from 'date-fns';
import { and, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { machineLogs, machines } from '@/lib/db/schema';
import type { LogCategory, LogFilters, LogLevel } from '@/lib/logs/types';
import { getUserOrganization } from './auth';

interface GetLogsOptions extends LogFilters {
  limit?: number;
  cursor?: string;
}

export async function getLogs(machineId: string, options: GetLogsOptions = {}) {
  const org = await getUserOrganization();
  if (!org) return { logs: [], nextCursor: null };

  // Verify machine
  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) return { logs: [], nextCursor: null };

  const limit = options.limit || 100;
  const conditions: ReturnType<typeof eq>[] = [eq(machineLogs.machineId, machineId)];

  if (options.level && options.level.length > 0) {
    conditions.push(inArray(machineLogs.level, options.level));
  }

  if (options.category && options.category.length > 0) {
    conditions.push(inArray(machineLogs.category, options.category));
  }

  if (options.search) {
    conditions.push(like(machineLogs.message, `%${options.search}%`));
  }

  if (options.from) {
    conditions.push(gte(machineLogs.timestamp, options.from));
  }

  if (options.to) {
    conditions.push(lte(machineLogs.timestamp, options.to));
  }

  const offset = options.cursor ? parseInt(options.cursor, 10) : 0;

  const results = await db
    .select()
    .from(machineLogs)
    .where(and(...conditions))
    .orderBy(desc(machineLogs.timestamp))
    .limit(limit + 1)
    .offset(offset);
  const hasMore = results.length > limit;
  const logs = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return { logs, nextCursor };
}

export async function getLogStats(machineId: string, days = 1) {
  const org = await getUserOrganization();
  if (!org) return { debug: 0, info: 0, warn: 0, error: 0 };

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine) return { debug: 0, info: 0, warn: 0, error: 0 };

  const since = subDays(new Date(), days);

  const [stats] = await db
    .select({
      debug: sql<number>`count(*) filter (where level = 'debug')`,
      info: sql<number>`count(*) filter (where level = 'info')`,
      warn: sql<number>`count(*) filter (where level = 'warn')`,
      error: sql<number>`count(*) filter (where level = 'error')`,
    })
    .from(machineLogs)
    .where(and(eq(machineLogs.machineId, machineId), gte(machineLogs.timestamp, since)));

  return {
    debug: Number(stats?.debug || 0),
    info: Number(stats?.info || 0),
    warn: Number(stats?.warn || 0),
    error: Number(stats?.error || 0),
  };
}

export async function insertLog(
  machineId: string,
  level: LogLevel,
  message: string,
  category?: LogCategory,
  metadata?: Record<string, unknown>
) {
  await db.insert(machineLogs).values({
    machineId,
    level,
    message,
    category,
    metadata: metadata || {},
  });
}

// Cleanup old logs (run via cron)
export async function cleanupOldLogs(daysToKeep = 30) {
  const cutoff = subDays(new Date(), daysToKeep);

  await db.delete(machineLogs).where(lte(machineLogs.timestamp, cutoff));
}
