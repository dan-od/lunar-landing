// Addresses are masked wherever the server writes them down for people to read:
// logs, events and replies (S-2). Only the first letter and the domain remain.

/** "dana@example.org" becomes "d•••@example.org". Anything else becomes "•••". */
export function maskEmail(address: unknown): string {
  if (typeof address !== 'string') return '•••';
  const at = address.lastIndexOf('@');
  if (at < 1 || at === address.length - 1 || /\s/.test(address)) return '•••';
  return `${address[0]}•••@${address.slice(at + 1)}`;
}
