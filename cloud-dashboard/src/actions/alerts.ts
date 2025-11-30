'use server';

import { startOfDay } from 'date-fns';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { alerts, machines } from '@/lib/db/schema';
import { getUser, getUserOrganization } from './auth';

interface GetAlertsOptions {
  severity?: string;
  status?: string;
  machine?: string;
}

export async function getAlerts(options: GetAlertsOptions = {}) {
  const org = await getUserOrganization();
  if (!org) return [];

  // Get organization machine IDs
  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);
  if (machineIds.length === 0) return [];

  const conditions: ReturnType<typeof eq>[] = [];

  // Machine filter
  const firstMachineId = machineIds[0];
  if (machineIds.length === 1 && firstMachineId) {
    conditions.push(eq(alerts.machineId, firstMachineId));
  }

  // Severity filter
  if (options.severity && options.severity !== 'all') {
    conditions.push(eq(alerts.severity, options.severity));
  }

  // Status filter
  if (options.status && options.status !== 'all') {
    switch (options.status) {
      case 'active':
        conditions.push(eq(alerts.resolved, false));
        conditions.push(eq(alerts.acknowledged, false));
        break;
      case 'acknowledged':
        conditions.push(eq(alerts.acknowledged, true));
        conditions.push(eq(alerts.resolved, false));
        break;
      case 'resolved':
        conditions.push(eq(alerts.resolved, true));
        break;
    }
  }

  // Specific machine filter
  if (options.machine) {
    conditions.push(eq(alerts.machineId, options.machine));
  }

  return db
    .select()
    .from(alerts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alerts.createdAt))
    .limit(100);
}

export async function getAlertStats() {
  const org = await getUserOrganization();
  if (!org) {
    return { critical: 0, error: 0, warning: 0, resolved: 0 };
  }

  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);
  if (machineIds.length === 0) {
    return { critical: 0, error: 0, warning: 0, resolved: 0 };
  }

  const today = startOfDay(new Date());

  // Active alerts by severity
  const stats = await db
    .select({
      critical: sql<number>`count(*) filter (where severity = 'critical' and resolved = false)`,
      error: sql<number>`count(*) filter (where severity = 'error' and resolved = false)`,
      warning: sql<number>`count(*) filter (where severity = 'warning' and resolved = false)`,
    })
    .from(alerts);

  // Resolved today
  const resolvedToday = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(alerts)
    .where(and(eq(alerts.resolved, true), gte(alerts.resolvedAt, today)));

  return {
    critical: Number(stats[0]?.critical || 0),
    error: Number(stats[0]?.error || 0),
    warning: Number(stats[0]?.warning || 0),
    resolved: Number(resolvedToday[0]?.count || 0),
  };
}

export async function getRecentAlerts(limit = 5) {
  const org = await getUserOrganization();
  if (!org) return [];

  const orgMachines = await db
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.organizationId, org.id));

  const machineIds = orgMachines.map((m) => m.id);
  if (machineIds.length === 0) return [];

  const conditions = [eq(alerts.resolved, false)];
  const firstMachineIdRecent = machineIds[0];
  if (machineIds.length === 1 && firstMachineIdRecent) {
    conditions.push(eq(alerts.machineId, firstMachineIdRecent));
  }

  return db
    .select()
    .from(alerts)
    .where(and(...conditions))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}

export async function acknowledgeAlert(alertId: string) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Verify alert belongs to org machine
  const alertResult = await db
    .select()
    .from(alerts)
    .innerJoin(machines, eq(alerts.machineId, machines.id))
    .where(and(eq(alerts.id, alertId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!alertResult[0]) throw new Error('Alert not found');

  await db
    .update(alerts)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: user.id,
    })
    .where(eq(alerts.id, alertId));

  revalidatePath('/alerts');
}

export async function resolveAlert(alertId: string) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Verify alert belongs to org machine
  const alertResult = await db
    .select()
    .from(alerts)
    .innerJoin(machines, eq(alerts.machineId, machines.id))
    .where(and(eq(alerts.id, alertId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!alertResult[0]) throw new Error('Alert not found');

  const existingAlert = alertResult[0].alerts;

  await db
    .update(alerts)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      acknowledged: true,
      acknowledgedAt: existingAlert.acknowledgedAt || new Date(),
      acknowledgedBy: existingAlert.acknowledgedBy || user.id,
    })
    .where(eq(alerts.id, alertId));

  revalidatePath('/alerts');
}

export async function createAlert(data: {
  machineId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  const org = await getUserOrganization();
  if (!org) throw new Error('Unauthorized');

  // Verify machine belongs to org
  const machine = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, data.machineId), eq(machines.organizationId, org.id)))
    .limit(1);

  if (!machine[0]) throw new Error('Machine not found');

  const [alert] = await db
    .insert(alerts)
    .values({
      machineId: data.machineId,
      severity: data.severity,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata || {},
    })
    .returning();

  revalidatePath('/alerts');
  return alert;
}
