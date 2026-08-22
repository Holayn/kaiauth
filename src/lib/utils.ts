import crypto from 'crypto';

export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// A same-origin path check, not a strict URI charset: a redirect target may legitimately
// carry a query string or fragment (e.g. '/admin?tab=orders'). Must start with a single
// '/' — not '//', which browsers treat as protocol-relative and would send the user off-origin.
export function isSameOriginPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}
