import { PrismaClient } from "@prisma/client";

// Singleton Prisma client — avoids exhausting connections during Next.js HMR.
// Server-only. Never import this into a client component.

// Supabase's transaction pooler occasionally drops idle connections; the next
// query can then surface a transient P1001 ("Can't reach database server")
// even though the database is healthy. P1001 means the connection was never
// established, so the query never ran — retrying is safe for reads AND writes
// (no risk of double-execution). We retry only this code to keep it safe.
const RETRYABLE_CODES = new Set(["P1001"]);
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends({
    name: "retry-on-transient-connection",
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            const code = (err as { code?: string })?.code;
            if (attempt >= MAX_ATTEMPTS || !code || !RETRYABLE_CODES.has(code)) {
              throw err;
            }
            await sleep(150 * attempt);
          }
        }
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

const client = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
}

// The $extends client keeps every model delegate and $transaction at runtime;
// we expose it as the base PrismaClient type so existing call sites (and the
// `TransactionClient` params they pass `prisma` into) type-check unchanged.
export const prisma = client as unknown as PrismaClient;
