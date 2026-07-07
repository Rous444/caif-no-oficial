import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { specialties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const getActiveSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  const data = await db
    .select()
    .from(specialties)
    .where(eq(specialties.isActive, true))
    .orderBy(asc(specialties.sortOrder));
  return data;
});
