"use server";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";

export interface JoinState {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "code", string>>;
}

const JoinInput = z.object({
  name: z.string().trim().min(1, "Please enter the name you would like us to use.").max(80),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(12, "Use at least 12 characters.").max(256),
  code: z.string().trim().min(1, "The bootstrap code is required."),
});

export async function createOwnerAccount(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = JoinInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    const fieldErrors: JoinState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<JoinState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const incoming = await headers();
  const forwarded = new Headers();
  for (const key of ["user-agent", "x-forwarded-for", "x-real-ip", "cookie", "origin"]) {
    const value = incoming.get(key);
    if (value) forwarded.set(key, value);
  }
  forwarded.set("x-bootstrap-code", parsed.data.code);
  try {
    await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
      headers: forwarded,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message || "The owner account could not be created." };
    }
    throw error;
  }
  redirect("/onboarding/1");
}
