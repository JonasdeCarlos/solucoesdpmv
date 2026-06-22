/**
 * Cache-busting em runtime para o link publicado.
 *
 * - Captura o hash do bundle JS atual (ex.: /assets/index-XXXX.js) na inicialização.
 * - A cada N minutos, busca /index.html sem cache e compara o hash.
 * - Se mudou (nova publicação), recarrega a página automaticamente.
 * - Também desregistra service workers antigos que possam estar servindo bundles obsoletos.
 */

const POLL_MS = 2 * 60 * 1000; // 2 minutos

function hasUnsavedEdits(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el) {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
  }
  // Heurística: rotas com formulários longos onde reload perde digitação.
  if (/\/sucesso-cliente\//.test(window.location.pathname)) return true;
  return false;
}

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

  // Só roda no site publicado (produção). Em preview/dev do Lovable e em
  // localhost o HMR/edição constante mudaria o bundle e dispararia reloads
  // que apagam o que o usuário está digitando.
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const isPreview =
    host.includes('lovableproject.com') ||
    host.includes('id-preview') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  // @ts-ignore — import.meta.env existe no Vite
  const isDev = !!(import.meta as any).env?.DEV;
  if (isPreview || isDev) return;

  // Limpa SWs antigos (esta app não usa SW; se houver, é resíduo).
  unregisterStaleServiceWorkers();

  const initial = currentBundleSignature();
  if (!initial) return;

  const check = async () => {
    const remote = await fetchRemoteSignature();
    if (remote && remote !== initial) {
      if (hasUnsavedEdits()) {
        // Adia o reload até que o usuário termine de digitar / saia da rota sensível.
        return;
      }
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