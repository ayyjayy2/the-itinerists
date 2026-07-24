/** 'makaela@gmail.com' → 'm•••@gmail.com' (for confirmation messages). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return `${email[0]}•••${email.slice(at)}`;
}
