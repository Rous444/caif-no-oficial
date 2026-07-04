import { createMiddleware } from "@tanstack/react-start";
import { auth } from "@/lib/auth.server";

export const requireAuth = createMiddleware().server(async ({ next }) => {
  return next();
});
