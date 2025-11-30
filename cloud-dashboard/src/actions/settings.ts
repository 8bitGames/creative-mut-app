'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { locations, organizationMembers, organizations } from '@/lib/db/schema';
import { getUser, getUserOrganization } from './auth';

// Organization Settings
export async function getOrganizationSettings() {
  const org = await getUserOrganization();
  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    settings: org.settings as Record<string, unknown>,
  };
}

export async function updateOrganizationSettings(data: {
  name?: string;
  settings?: Record<string, unknown>;
}) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Check if user is owner or admin
  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  const role = member[0]?.role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Insufficient permissions');
  }

  await db
    .update(organizations)
    .set({
      name: data.name,
      settings: data.settings,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  revalidatePath('/settings');
}

// Team Members
export async function getTeamMembers() {
  const org = await getUserOrganization();
  if (!org) return [];

  const members = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, org.id));

  return members;
}

export async function inviteTeamMember(email: string, _role: string) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Check if user is owner or admin
  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  const currentRole = member[0]?.role;
  if (currentRole !== 'owner' && currentRole !== 'admin') {
    throw new Error('Insufficient permissions');
  }

  // In a real app, this would send an invitation email
  // For now, we'll just return a pending invite status
  return { success: true, message: `Invitation sent to ${email}` };
}

export async function updateMemberRole(memberId: string, role: string) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Check if user is owner
  const currentMember = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (currentMember[0]?.role !== 'owner') {
    throw new Error('Only owners can change roles');
  }

  await db
    .update(organizationMembers)
    .set({ role })
    .where(
      and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, org.id))
    );

  revalidatePath('/settings');
}

export async function removeMember(memberId: string) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  // Check if user is owner or admin
  const currentMember = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  const currentRole = currentMember[0]?.role;
  if (currentRole !== 'owner' && currentRole !== 'admin') {
    throw new Error('Insufficient permissions');
  }

  // Don't allow removing yourself
  const targetMember = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, memberId))
    .limit(1);

  if (targetMember[0]?.userId === user.id) {
    throw new Error('Cannot remove yourself');
  }

  await db
    .delete(organizationMembers)
    .where(
      and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, org.id))
    );

  revalidatePath('/settings');
}

// Locations
export async function getLocations() {
  const org = await getUserOrganization();
  if (!org) return [];

  return db.select().from(locations).where(eq(locations.organizationId, org.id));
}

export async function createLocation(data: {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}) {
  const user = await getUser();
  const org = await getUserOrganization();
  if (!user || !org) throw new Error('Unauthorized');

  const [location] = await db
    .insert(locations)
    .values({
      organizationId: org.id,
      name: data.name,
      address: data.address,
      city: data.city,
      country: data.country,
      timezone: data.timezone || 'UTC',
    })
    .returning();

  revalidatePath('/settings');
  return location;
}

export async function updateLocation(
  locationId: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    timezone?: string;
    isActive?: boolean;
  }
) {
  const org = await getUserOrganization();
  if (!org) throw new Error('Unauthorized');

  await db
    .update(locations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(locations.id, locationId), eq(locations.organizationId, org.id)));

  revalidatePath('/settings');
}

export async function deleteLocation(locationId: string) {
  const org = await getUserOrganization();
  if (!org) throw new Error('Unauthorized');

  await db
    .delete(locations)
    .where(and(eq(locations.id, locationId), eq(locations.organizationId, org.id)));

  revalidatePath('/settings');
}
