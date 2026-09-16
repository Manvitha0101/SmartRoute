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
});

export const googleLoginSchema = z.object({
  credential: z.string().optional(),
  email: z.string().email("Must be a valid email address").optional(),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "DISPATCHER"]).default("DISPATCHER").optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
