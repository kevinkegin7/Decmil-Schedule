import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, { error: "Email is required" }).pipe(z.email({ error: "Enter a valid email address" })),
  password: z.string().min(1, { error: "Password is required" }).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const pauseSchema = z.object({
  paused: z.boolean(),
  reason: z.string().trim().max(500, { error: "Reason must be 500 characters or fewer" }),
});
export type PauseInput = z.infer<typeof pauseSchema>;
