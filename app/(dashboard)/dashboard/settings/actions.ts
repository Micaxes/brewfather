"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteUserBrewfatherCredentials,
  saveUserBrewfatherCredentials,
} from "@/lib/brewfather/user-credentials";

const SETTINGS = "/dashboard/settings";

export async function connectBrewfather(formData: FormData): Promise<void> {
  const bfUserId = String(formData.get("bf_user_id") ?? "").trim();
  const apiKey = String(formData.get("api_key") ?? "").trim();
  if (!bfUserId || !apiKey) {
    redirect(`${SETTINGS}?error=${encodeURIComponent("Both fields are required.")}`);
  }
  try {
    await saveUserBrewfatherCredentials(bfUserId, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save credentials.";
    redirect(`${SETTINGS}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard", "layout");
  redirect(`${SETTINGS}?message=${encodeURIComponent("Brewfather account connected.")}`);
}

export async function disconnectBrewfather(): Promise<void> {
  try {
    await deleteUserBrewfatherCredentials();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect.";
    redirect(`${SETTINGS}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard", "layout");
  redirect(`${SETTINGS}?message=${encodeURIComponent("Brewfather account disconnected.")}`);
}
