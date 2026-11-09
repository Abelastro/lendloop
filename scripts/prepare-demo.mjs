import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error(
    "CLERK_SECRET_KEY is missing. Run with --env-file=.env --env-file=.env.local.",
  );
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });

const demoPeople = [
  {
    email: ["lendloop.admin+clerk_test", "example.com"].join("@"),
    firstName: "Avery",
    lastName: "Admin",
  },
  {
    email: ["lendloop.lender+clerk_test", "example.com"].join("@"),
    firstName: "Maya",
    lastName: "Chen",
  },
  {
    email: ["lendloop.borrower+clerk_test", "example.com"].join("@"),
    firstName: "Eli",
    lastName: "Rivera",
  },
];

async function ensureUser(person) {
  const found = await clerk.users.getUserList({
    emailAddress: [person.email],
  });
  if (found.data.length > 0) {
    return found.data[0];
  }
  return await clerk.users.createUser({
    emailAddress: [person.email],
    firstName: person.firstName,
    lastName: person.lastName,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
}

const users = [];
for (const person of demoPeople) {
  const user = await ensureUser(person);
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    person.firstName;
  users.push({
    clerkId: user.id,
    email: person.email,
    name,
    userId: user.id,
  });
}

const seedArgs = JSON.stringify({
  users: users.map(({ clerkId, email, name }) => ({ clerkId, email, name })),
});

const seed = spawnSync("npx", ["convex", "run", "dev:seedDemoData", seedArgs], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  timeout: 120_000,
});

if (seed.status !== 0) {
  console.error(seed.stdout);
  console.error(seed.stderr);
  process.exit(seed.status ?? 1);
}

const tickets = [];
for (const user of users) {
  const ticket = await clerk.signInTokens.createSignInToken({
    userId: user.userId,
    expiresInSeconds: 3600,
  });
  tickets.push({
    email: user.email,
    name: user.name,
    clerkId: user.clerkId,
    url: ticket.url,
  });
}

const outPath = "/tmp/lendloop-demo-users.json";
writeFileSync(outPath, JSON.stringify(tickets, null, 2), { mode: 0o600 });

console.log(`Seeded ${users.length} demo users.`);
console.log(`Sign-in tickets written to ${outPath} (valid for one hour).`);
for (const user of users) {
  console.log(`- ${user.name} <${user.email}>`);
}
