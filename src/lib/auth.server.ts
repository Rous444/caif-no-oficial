import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [tanstackStartCookies()],
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
});
