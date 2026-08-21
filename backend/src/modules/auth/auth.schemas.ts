/**
 * auth.schemas.ts — Zod validation schemas for auth endpoints.
 *
 * WHY ZOD OVER JOI: Zod is TypeScript-first. It infers TypeScript types
 * from schemas directly — you don't write the type AND the schema separately.
 * z.infer<typeof registerSchema> gives you the TypeScript type for free.
 *
 * WHY IN A SEPARATE FILE: Schemas belong to the module that uses them.
 * Validators are reusable (the same schema can validate the body AND be used
 * to generate API docs). Keeping them separate from the controller keeps
 * files focused.
 */

import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/\d/, "Password must contain at least one number"),
  role: z.enum(["ADMIN", "DISPATCHER"]).default("DISPATCHER"),
});

export const loginSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
  // min(1) not min(8) — wrong password should be caught by bcrypt, not Zod.
  // Telling the user "password too short" before checking credentials leaks info.
});

// TypeScript types inferred from Zod schemas — no duplication
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
