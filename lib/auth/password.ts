/**
 * Shared password-reset constants.
 *
 * Kept out of `app/reset-password/actions.ts` because a `"use server"` module
 * may only export async functions — Next strips anything else, so importing a
 * constant from there fails the build.
 */

/** Matches the client-side `minLength` on the reset form's password fields. */
export const MIN_PASSWORD_LENGTH = 6;

/** Shown when a recovery link is dead, spent, or never established a session. */
export const EXPIRED_SESSION_MESSAGE =
  "That password reset link is invalid, expired, or has already been used. Ask for a new one.";
