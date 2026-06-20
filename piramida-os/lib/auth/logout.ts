"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import { DEMO_COOKIE } from "../demo/personas";

/**
 * Shared sign-out server action. Clears BOTH auth sources — the real Supabase
 * session and the DEMO_MODE cookie — then sends the user to /login.
 *
 * Safe to use as a `<form action={logoutAction}>` target from client shells
 * (AdminShell, OrganizerShell, ManagerShell) which cannot define inline
 * server actions themselves.
 */
export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  const c = await cookies();
  c.delete(DEMO_COOKIE);
  redirect("/login");
}
