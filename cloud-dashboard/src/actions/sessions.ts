'use server';

import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { machines, sessions } from '@/lib/db/schema';
import { getUserOrganization } from './auth';

interface GetSessionsOptions {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  machine?: string;
  cursor?: string;
  limit?: number;
}

export async function getSessions(options: GetSessionsOptions = {}) {
  const org = await getUserOrganization();
  if (!org) return { sessions: [], total: 0 };

  const limit = options.limit || 20;

  // Get machine IDs for this organization
  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);

  if (machineIds.length === 0) {
    return { sessions: [], total: 0 };
  }

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [];

  const firstMachineId = machineIds[0];
  if (machineIds.length === 1 && firstMachineId) {
    conditions.push(eq(sessions.machineId, firstMachineId));
  }

  if (options.status) {
    conditions.push(eq(sessions.status, options.status));
  }

  if (options.q) {
    conditions.push(like(sessions.sessionCode, `%${options.q}%`));
  }

  if (options.from) {
    conditions.push(gte(sessions.startedAt, new Date(options.from)));
  }

  if (options.to) {
    conditions.push(lte(sessions.startedAt, new Date(options.to)));
  }

  if (options.machine) {
    conditions.push(eq(sessions.machineId, options.machine));
  }

  // Get total count
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(whereClause);

  const total = Number(countResult[0]?.count || 0);

  // Get sessions with cursor pagination
  const currentOffset = options.cursor ? parseInt(options.cursor, 10) : 0;

  const results = await db
    .select()
    .from(sessions)
    .where(whereClause)
    .orderBy(desc(sessions.startedAt))
    .limit(limit + 1)
    .offset(currentOffset);

  const hasMore = results.length > limit;
  const sessionData = hasMore ? results.slice(0, limit) : results;

  const nextCursor = hasMore ? String(currentOffset + limit) : null;
  const prevCursor = currentOffset > 0 ? String(Math.max(0, currentOffset - limit)) : null;

  return {
    sessions: sessionData,
    total,
    nextCursor,
    prevCursor,
  };
}

export async function getSession(id: string) {
  const org = await getUserOrganization();
  if (!org) return null;

  // Verify the session belongs to an org machine
  const result = await db
    .select()
    .from(sessions)
    .innerJoin(machines, eq(sessions.machineId, machines.id))
    .where(and(eq(sessions.id, id), eq(machines.organizationId, org.id)))
    .limit(1);

  return result[0]?.sessions || null;
}

export async function getSessionStats(machineId?: string) {
  const org = await getUserOrganization();
  if (!org) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get machine IDs
  let machineIds: string[];
  if (machineId) {
    machineIds = [machineId];
  } else {
    const orgMachines = await db
      .select({ id: machines.id })
      .from(machines)
      .where(eq(machines.organizationId, org.id));
    machineIds = orgMachines.map((m) => m.id);
  }

  if (machineIds.length === 0) return null;

  // Today's stats
  const todayConditions = [gte(sessions.startedAt, today)];
  const firstStatsId = machineIds[0];
  if (machineIds.length === 1 && firstStatsId) {
    todayConditions.push(eq(sessions.machineId, firstStatsId));
  }

  const todayStats = await db
    .select({
      count: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where status = 'completed')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
      avgProcessingTime: sql<number>`avg(processing_time_ms)`,
    })
    .from(sessions)
    .where(and(...todayConditions));

  // All time stats
  const allTimeConditions =
    machineIds.length === 1 && firstStatsId ? [eq(sessions.machineId, firstStatsId)] : [];

  const allTimeStats = await db
    .select({
      total: sql<number>`count(*)`,
      totalCompleted: sql<number>`count(*) filter (where status = 'completed')`,
    })
    .from(sessions)
    .where(allTimeConditions.length > 0 ? and(...allTimeConditions) : undefined);

  return {
    today: {
      total: Number(todayStats[0]?.count || 0),
      completed: Number(todayStats[0]?.completed || 0),
      failed: Number(todayStats[0]?.failed || 0),
      avgProcessingTime: todayStats[0]?.avgProcessingTime
        ? Math.round(Number(todayStats[0].avgProcessingTime))
        : null,
    },
    allTime: {
      total: Number(allTimeStats[0]?.total || 0),
      completed: Number(allTimeStats[0]?.totalCompleted || 0),
    },
  };
}
