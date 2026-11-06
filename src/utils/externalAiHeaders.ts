/** Credentials are sent only to explicitly selected functions on our own backend. */
export function externalAiHeaders(): Record<string, string> {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const kind = parts[0];
  const token = parts[1];
  if (!token) return {};
  if (kind === 'premiacao-gestor') return { 'x-external-token': token, 'x-external-password': sessionStorage.getItem(`prem-gestor-${token}`) || '' };
  if (kind === 'premio') return { 'x-external-token': token, 'x-external-password': sessionStorage.getItem(`premio_pwd_${token}`) || '' };
  if (kind === 'escala-publica') return { 'x-external-token': token, 'x-external-password': sessionStorage.getItem(`escala-pin-${token}`) || '' };
  if (kind === 'pec-publica') return { 'x-external-token': token };
  return {};
}