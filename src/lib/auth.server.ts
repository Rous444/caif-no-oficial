import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [tanstackStartCookies()],
  advanced: {
    disableCSRFCheck: true,
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:8080"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: async (password) => {
        const bcrypt = await import("bcryptjs");
        return bcrypt.hash(password, 12);
      },
      verify: async ({ password, hash }) => {
        const bcrypt = await import("bcryptjs");
        return bcrypt.compare(password, hash);
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      middleName: { type: "string", required: false },
      lastName: { type: "string", required: true },
      phone: { type: "string", required: true },
      role: { type: "string", required: true },
      mustChangePassword: { type: "boolean", required: false },
      isActive: { type: "boolean", required: false },
    },
  },
  pages: {
    signIn: "/login",
    signUp: "/register",
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const email = ctx.body?.email as string | undefined;
        if (email) {
          const existing = await db.query.user.findFirst({
            where: eq(schema.user.email, email),
            columns: { isActive: true },
          });
          if (existing && existing.isActive === false) {
            throw new APIError("FORBIDDEN", {
              message: "Esta cuenta está desactivada. Contactá al consultorio.",
            });
          }
        }
      }
    }),
  },
});
