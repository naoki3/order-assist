/**
 * New-user registration (sign-up) feature flag.
 *
 * The sign-up feature stays in the codebase; this flag only gates whether it is
 * currently accepting new accounts. To re-enable registration, set the env var
 * NEXT_PUBLIC_REGISTRATION_ENABLED=true and redeploy. Anything else (including
 * unset) keeps registration closed.
 *
 * NEXT_PUBLIC_ prefix is required so the same flag is readable from both server
 * code (sign-up action, proxy) and client components (login/LP/sign-up pages).
 */
export const REGISTRATION_ENABLED =
  process.env.NEXT_PUBLIC_REGISTRATION_ENABLED === 'true';
