import 'dotenv/config';
import { generateApiKey } from '../src/lib/api/keys';
import { db } from '../src/lib/db';
import { apiKeys, organizations } from '../src/lib/db/schema';

async function createApiKey() {
  console.log('Creating API key for local development...\n');

  // Get or create organization
  let [org] = await db.select().from(organizations).limit(1);

  if (!org) {
    console.log('No organization found, creating one...');
    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: 'Local Development',
        slug: 'local-dev',
        plan: 'pro',
      })
      .returning();
    org = newOrg;
    if (!org) {
      throw new Error('Failed to create organization');
    }
    console.log('Created organization:', org.name);
  } else {
    console.log('Using existing organization:', org.name);
  }

  // Generate API key
  const { key, hash, prefix } = generateApiKey();

  // Insert API key
  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      organizationId: org.id,
      name: 'Local Development Key',
      keyHash: hash,
      keyPrefix: prefix,
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    })
    .returning();

  if (!apiKey) {
    throw new Error('Failed to create API key');
  }

  console.log('\n========================================');
  console.log('API Key Created Successfully!');
  console.log('========================================');
  console.log('Key ID:', apiKey.id);
  console.log('Organization:', org.name);
  console.log('\nAPI Key (save this - it will not be shown again):');
  console.log(key);
  console.log('\n========================================');
  console.log('\nAdd this to your .env file:');
  console.log(`CLOUD_API_URL=http://localhost:3000/api`);
  console.log(`CLOUD_API_KEY=${key}`);
  console.log('========================================\n');

  process.exit(0);
}

createApiKey().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
