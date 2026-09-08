"use server";

import { signIn as signInAction, signOut as signOutAction } from "@/lib/auth";

export async function signIn(email: string, password: string) {
  return signInAction(email, password);
}

export async function signOut() {
  await signOutAction();
}