/**
 * Supabase Auth enforces a minimum password length of 6 characters.
 * This helper pads passwords under 6 characters deterministically
 * so users can create and use short passwords/PINs (e.g. 3 characters)
 * seamlessly without triggering Supabase Auth errors.
 */
export function formatAuthPassword(password: string): string {
  if (!password) return "";
  return password.length < 6 ? password.padEnd(6, password) : password;
}
