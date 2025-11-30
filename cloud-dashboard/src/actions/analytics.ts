'use server';

import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { machines, sessions } from '@/lib/db/schema';
import { getUserOrganization } from './auth';

interface DateRange {
  period?: string;
  from?: string;
  to?: string;
}

function parseDateRange(dateRange: DateRange) {
  let from: Date;
  let to: Date = endOfDay(new Date());

  if (dateRange.from && dateRange.to) {
    from = new Date(dateRange.from);
    to = new Date(dateRange.to);
  } else {
    const days = dateRange.period === '30d' ? 30 : dateRange.period === '90d' ? 90 : 7;
    from = subDays(new Date(), days);
  }

  return { from: startOfDay(from), to: endOfDay(to) };
}

export async function getAnalyticsSummary(dateRange: DateRange) {
  const org = await getUserOrganization();
  if (!org) {
    return {
      totalSessions: 0,
      sessionsChange: 0,
      activeMachines: 0,
      machinesChange: 0,
      successRate: 0,
      successRateChange: 0,
      revenue: 0,
      revenueChange: 0,
    };
  }

  const { from, to } = parseDateRange(dateRange);

  // Get machine IDs
  const orgMachines = await db.select().from(machines).where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);
  const activeMachines = orgMachines.filter((m) => m.status === 'online').length;

  if (machineIds.length === 0) {
    return {
      totalSessions: 0,
      sessionsChange: 0,
      activeMachines: 0,
      machinesChange: 0,
      successRate: 0,
      successRateChange: 0,
      revenue: 0,
      revenueChange: 0,
    };
  }

  // Current period stats
  const currentConditions = [gte(sessions.startedAt, from), lte(sessions.startedAt, to)];
  const firstMachineId = machineIds[0];
  if (machineIds.length === 1 && firstMachineId) {
    currentConditions.push(eq(sessions.machineId, firstMachineId));
  }

  const currentStats = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where status = 'completed')`,
      revenue: sql<number>`coalesce(sum(payment_amount), 0)`,
    })
    .from(sessions)
    .where(and(...currentConditions));

  // Previous period for comparison
  const periodLength = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodLength);
  const prevTo = new Date(to.getTime() - periodLength);

  const prevConditions = [gte(sessions.startedAt, prevFrom), lte(sessions.startedAt, prevTo)];
  if (machineIds.length === 1 && firstMachineId) {
    prevConditions.push(eq(sessions.machineId, firstMachineId));
  }

  const prevStats = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where status = 'completed')`,
      revenue: sql<number>`coalesce(sum(payment_amount), 0)`,
    })
    .from(sessions)
    .where(and(...prevConditions));

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const currentTotal = Number(currentStats[0]?.total || 0);
  const currentCompleted = Number(currentStats[0]?.completed || 0);
  const prevTotal = Number(prevStats[0]?.total || 0);
  const prevCompleted = Number(prevStats[0]?.completed || 0);

  const successRate = currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0;

  const prevSuccessRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;

  return {
    totalSessions: currentTotal,
    sessionsChange: calculateChange(currentTotal, prevTotal),
    activeMachines,
    machinesChange: 0,
    successRate,
    successRateChange: successRate - prevSuccessRate,
    revenue: Number(currentStats[0]?.revenue || 0),
    revenueChange: calculateChange(
      Number(currentStats[0]?.revenue || 0),
      Number(prevStats[0]?.revenue || 0)
    ),
  };
}

export async function getSessionVolumeData(dateRange: DateRange) {
  const org = await getUserOrganization();
  if (!org) return [];

  const { from, to } = parseDateRange(dateRange);

  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);
  if (machineIds.length === 0) return [];

  const conditions = [gte(sessions.startedAt, from), lte(sessions.startedAt, to)];
  const firstMachineIdVolume = machineIds[0];
  if (machineIds.length === 1 && firstMachineIdVolume) {
    conditions.push(eq(sessions.machineId, firstMachineIdVolume));
  }

  const data = await db
    .select({
      date: sql<string>`date(started_at)`,
      sessions: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where status = 'completed')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
    })
    .from(sessions)
    .where(and(...conditions))
    .groupBy(sql`date(started_at)`)
    .orderBy(sql`date(started_at)`);

  // Fill in missing dates
  const days = eachDayOfInterval({ start: from, end: to });
  const dataMap = new Map(data.map((d) => [d.date, d]));

  return days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const existing = dataMap.get(dateStr);
    return {
      date: format(day, 'MMM d'),
      sessions: existing ? Number(existing.sessions) : 0,
      completed: existing ? Number(existing.completed) : 0,
      failed: existing ? Number(existing.failed) : 0,
    };
  });
}

export async function getMachineUtilization(dateRange: DateRange) {
  const org = await getUserOrganization();
  if (!org) return [];

  const { from, to } = parseDateRange(dateRange);

  const orgMachines = await db.select().from(machines).where(eq(machines.organizationId, org.id));

  const results = await Promise.all(
    orgMachines.map(async (machine) => {
      const stats = await db
        .select({
          sessions: sql<number>`count(*)`,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.machineId, machine.id),
            gte(sessions.startedAt, from),
            lte(sessions.startedAt, to)
          )
        );

      return {
        name: machine.name || machine.id.slice(0, 8),
        sessions: Number(stats[0]?.sessions || 0),
        status: machine.status as 'online' | 'offline' | 'error',
      };
    })
  );

  return results.sort((a, b) => b.sessions - a.sessions);
}

export async function getStatusBreakdown(dateRange: DateRange) {
  const org = await getUserOrganization();
  if (!org) return [];

  const { from, to } = parseDateRange(dateRange);

  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);
  if (machineIds.length === 0) return [];

  const conditions = [gte(sessions.startedAt, from), lte(sessions.startedAt, to)];
  const firstMachineIdStatus = machineIds[0];
  if (machineIds.length === 1 && firstMachineIdStatus) {
    conditions.push(eq(sessions.machineId, firstMachineIdStatus));
  }

  const data = await db
    .select({
      status: sessions.status,
      count: sql<number>`count(*)`,
    })
    .from(sessions)
    .where(and(...conditions))
    .groupBy(sessions.status);

  return data.map((d) => ({
    status: d.status || 'unknown',
    count: Number(d.count),
  }));
}
