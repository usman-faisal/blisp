/**
 * Syncs Clerk users into the local database.
 *
 * Local dev workaround: user rows are normally created by the Clerk webhook
 * (POST /api/v1/webhook/clerk), but Clerk's servers cannot reach a machine on a
 * private network, so signing up locally never creates the row. Every
 * authenticated request then fails — ClerkStrategy verifies the token, fails the
 * `getUser` lookup, and reports it as 401 "Invalid token".
 *
 * Run this after signing up to pull existing Clerk users into Postgres:
 *   pnpm --filter backend sync:users
 *
 * Once a public tunnel + webhook is configured, this script is no longer needed.
 *
 * Mirrors the upsert in webhook.service.ts (handleUserCreated).
 */
import { prisma } from '@repo/db';

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string | null;
  email_addresses: ClerkEmailAddress[];
}

async function fetchClerkUsers(secretKey: string): Promise<ClerkUser[]> {
  const users: ClerkUser[] = [];
  const limit = 100;
  let offset = 0;

  // Paginate so this keeps working past the first 100 users.
  for (;;) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    if (!res.ok) {
      throw new Error(
        `Clerk API returned ${res.status} ${res.statusText}: ${await res.text()}`,
      );
    }

    const page = (await res.json()) as ClerkUser[];
    users.push(...page);

    if (page.length < limit) break;
    offset += limit;
  }

  return users;
}

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    console.error(
      'CLERK_SECRET_KEY is not set. Add it to apps/backend/.env and retry.',
    );
    process.exit(1);
  }

  const clerkUsers = await fetchClerkUsers(secretKey);
  console.log(`Found ${clerkUsers.length} user(s) in Clerk.`);

  let synced = 0;
  let skipped = 0;

  for (const user of clerkUsers) {
    // Prefer the primary address, but fall back to the first one on file —
    // users created via OAuth may not have primary_email_address_id set.
    const primaryEmail =
      user.email_addresses.find((e) => e.id === user.primary_email_address_id) ??
      user.email_addresses[0];

    if (!primaryEmail) {
      console.warn(`  skip ${user.id} — no email address on the Clerk record`);
      skipped++;
      continue;
    }

    const name =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      primaryEmail.email_address.split('@')[0];

    await prisma.user.upsert({
      where: { id: user.id },
      update: { name, email: primaryEmail.email_address },
      create: { id: user.id, name, email: primaryEmail.email_address },
    });

    console.log(`  synced ${user.id} (${primaryEmail.email_address})`);
    synced++;
  }

  console.log(`\nDone. ${synced} synced, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error('Failed to sync Clerk users:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
