/**
 * Cache-busting em runtime para o link publicado.
 *
 * - Captura o hash do bundle JS atual (ex.: /assets/index-XXXX.js) na inicialização.
 * - A cada N minutos, busca /index.html sem cache e compara o hash.
 * - Se mudou (nova publicação), recarrega a página automaticamente.
 * - Também desregistra service workers antigos que possam estar servindo bundles obsoletos.
 */

const POLL_MS = 2 * 60 * 1000; // 2 minutos

function currentBundleSignature(): string {
  const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
  return scripts
    .map((s) => s.getAttribute('src') || '')
    .filter((src) => src.includes('/assets/') || src.includes('main.tsx'))
    .join('|');
}

async function fetchRemoteSignature(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g));
    return matches
      .map((m) => m[1])
      .filter((src) => src.includes('/assets/') || src.includes('main.tsx'))
      .join('|');
  } catch {
    return null;
  }
}

async function unregisterStaleServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* noop */
  }
}

let started = false;

export function startVersionCheck() {
  if (started) return;
  started = true;

  // Limpa SWs antigos (esta app não usa SW; se houver, é resíduo).
  unregisterStaleServiceWorkers();

  const initial = currentBundleSignature();
  if (!initial) return;

  const check = async () => {
    const remote = await fetchRemoteSignature();
    if (remote && remote !== initial) {
      // Nova versão publicada — recarrega forçando bypass de cache.
      window.location.reload();
    }
  };

  // Primeira verificação após 30s, depois a cada POLL_MS.
  setTimeout(check, 30_000);
  setInterval(check, POLL_MS);

  // Também verifica quando a aba volta a ficar visível.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}