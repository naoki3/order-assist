/**
 * Temporary global login lockdown (maintenance mode).
 *
 * Set LOGIN_LOCKDOWN=true to block ALL logins at once, without touching any
 * per-user is_active flag. Unset it (or anything other than "true") and normal
 * login — including the per-user disable behaviour — resumes unchanged.
 *
 * Server-only flag (no NEXT_PUBLIC_ prefix): it is enforced in the login
 * server action, so it never needs to reach the client.
 */
export const LOGIN_LOCKDOWN = process.env.LOGIN_LOCKDOWN === 'true';
