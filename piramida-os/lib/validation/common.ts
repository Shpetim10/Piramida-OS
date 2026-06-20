import { z } from "zod";

/**
 * Shared Zod primitives for Piramida / Pyramid OS input validation.
 *
 * Conventions:
 * - All free text is trimmed and length-capped (defence against unbounded input).
 * - Money is a non-negative finite number (Prisma Decimal is set in the service).
 * - Quantities are integers; "positive" (>= 1) vs "nonNeg" (>= 0) are distinct.
 * - Dates accept ISO strings or Date and coerce to Date.
 * - Enums are validated with z.nativeEnum(<PrismaEnum>) so they can never drift
 *   from the database — the Prisma client is the single source of truth.
 */

export const trimmed = (max = 500) => z.string().trim().max(max);
export const requiredText = (max = 500) => trimmed(max).min(1, "Required");

export const emailSchema = z.email("Invalid email").max(320).transform((s) => s.toLowerCase());

// Permissive international phone: digits, spaces and + ( ) - . only.
export const phoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[+0-9()\-.\s]+$/, "Invalid phone number");

// Lower-kebab slug, no leading/trailing/double hyphens.
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug (use lower-kebab-case)");

export const uuid = z.uuid("Invalid id");

export const money = z.coerce
  .number({ error: "Must be a number" })
  .nonnegative("Must be >= 0")
  .finite();

export const positiveInt = z.coerce
  .number({ error: "Must be a number" })
  .int("Must be an integer")
  .positive("Must be > 0");

export const nonNegInt = z.coerce
  .number({ error: "Must be a number" })
  .int("Must be an integer")
  .nonnegative("Must be >= 0");

export const dateSchema = z.coerce.date({ error: "Invalid date" });

// Arbitrary JSON (metadata / valueJson / extractedJson / detail / payload).
export const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);
export const jsonObject = z.record(z.string(), jsonValue);

/**
 * Reservation / event window ordering:
 *   setupStart <= eventStart < eventEnd <= teardownEnd
 * Attach with `.superRefine(eventWindowRefine)` on any schema exposing those
 * four fields (all optional — only present pairs are checked).
 */
export function eventWindowRefine(
  data: {
    setupStart?: Date | null;
    eventStart?: Date | null;
    eventEnd?: Date | null;
    teardownEnd?: Date | null;
  },
  ctx: z.RefinementCtx,
): void {
  const { setupStart, eventStart, eventEnd, teardownEnd } = data;
  if (eventStart && eventEnd && !(eventStart < eventEnd)) {
    ctx.addIssue({ code: "custom", path: ["eventEnd"], message: "eventEnd must be after eventStart" });
  }
  if (setupStart && eventStart && setupStart > eventStart) {
    ctx.addIssue({ code: "custom", path: ["setupStart"], message: "setupStart must be <= eventStart" });
  }
  if (eventEnd && teardownEnd && teardownEnd < eventEnd) {
    ctx.addIssue({ code: "custom", path: ["teardownEnd"], message: "teardownEnd must be >= eventEnd" });
  }
}

/** Exactly one of the given keys must be present (non-null/undefined). */
export function exactlyOne<T extends Record<string, unknown>>(
  data: T,
  keys: (keyof T)[],
  ctx: z.RefinementCtx,
  message: string,
): void {
  const present = keys.filter((k) => data[k] !== undefined && data[k] !== null);
  if (present.length !== 1) {
    ctx.addIssue({ code: "custom", path: [String(keys[0])], message });
  }
}

/** At least one of the given keys must be present. */
export function atLeastOne<T extends Record<string, unknown>>(
  data: T,
  keys: (keyof T)[],
  ctx: z.RefinementCtx,
  message: string,
): void {
  const present = keys.filter((k) => data[k] !== undefined && data[k] !== null);
  if (present.length < 1) {
    ctx.addIssue({ code: "custom", path: [String(keys[0])], message });
  }
}
