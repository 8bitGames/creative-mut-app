import { and, lt, ne } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { machines } from '@/lib/db/schema';

const OFFLINE_THRESHOLD_MINUTES = 5;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000);

    // Mark machines offline if no heartbeat
    const result = await db
      .update(machines)
      .set({ status: 'offline', updatedAt: new Date() })
      .where(and(lt(machines.lastHeartbeat, cutoff), ne(machines.status, 'offline')))
      .returning({ id: machines.id });

    return Response.json({
      success: true,
      offlinedMachines: result.length,
    });
  } catch (error) {
    console.error('Machine status cron error:', error);
    return Response.json({ success: false }, { status: 500 });
  }
}
