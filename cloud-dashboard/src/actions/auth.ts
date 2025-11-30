'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { organizationMembers, organizations } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  organizationName: z.string().min(2, 'Organization name is required'),
});

export async function login(formData: FormData) {
  const supabase = await createClient();

  try {
    const data = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
      return { error: error.message };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || 'Invalid input' };
    }
    return { error: 'An error occurred' };
  }

  redirect('/overview');
}

export async function register(formData: FormData) {
  const supabase = await createClient();

  try {
    const data = registerSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      name: formData.get('name'),
      organizationName: formData.get('organizationName'),
    });

    // Create user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
        },
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    if (authData.user) {
      // Create organization
      const slug = data.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const [org] = await db
        .insert(organizations)
        .values({
          name: data.organizationName,
          slug: `${slug}-${Date.now()}`,
        })
        .returning();

      // Add user as owner
      if (org) {
        await db.insert(organizationMembers).values({
          organizationId: org.id,
          userId: authData.user.id,
          role: 'owner',
        });
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || 'Invalid input' };
    }
    return { error: 'An error occurred' };
  }

  redirect('/login?message=check_email');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getUser() {
  // Development bypass - return mock user
  if (process.env.BYPASS_AUTH === 'true') {
    return {
      id: 'dev-user-id',
      email: 'dev@localhost',
      user_metadata: { name: 'Development User' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as import('@supabase/supabase-js').User;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserOrganization() {
  // Development bypass - return first organization
  if (process.env.BYPASS_AUTH === 'true') {
    const [org] = await db.select().from(organizations).limit(1);
    return org || null;
  }

  const user = await getUser();
  if (!user) return null;

  const member = await db.query.organizationMembers.findFirst({
    where: (members, { eq }) => eq(members.userId, user.id),
    with: {
      organization: true,
    },
  });

  return member?.organization || null;
}
