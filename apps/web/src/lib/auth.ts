import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { account, session, user, verification } from "@corniversity/db/schema/auth";
import { assertBootstrapAllowed, completeBootstrap, isBootstrapComplete } from "@corniversity/db/services/bootstrap";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

const env = getEnv();
const { db } = getDb();

/**
 * Authentication for the private institution. Email + password (scrypt) through better-auth.
 * Sign-up is closed: the only account that can be created is the owner's, and only with the
 * owner email plus the one-time bootstrap code supplied as a header. After that, sign-up is
 * refused outright. Every private page and API still verifies the session server-side.
 */
export const auth = betterAuth({
  appName: env.INSTITUTION_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "learner", returned: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: env.DEPLOYMENT_MODE === "production",
    cookiePrefix: "corniversity",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (data) => {
          // The first (and only) account created through bootstrap is the owner.
          const complete = await isBootstrapComplete(db);
          return { data: { ...data, role: complete ? "learner" : "owner" } };
        },
        after: async (created) => {
          await completeBootstrap(db, created.id);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
      const code = ctx.headers?.get("x-bootstrap-code") ?? "";
      const result = await assertBootstrapAllowed(db, { email, code, env });
      if (!result.ok) {
        throw new APIError("FORBIDDEN", { message: result.reason });
      }
    }),
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
