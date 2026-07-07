import type { Annotation, EditorSessionMeta } from './types';

const KEY = 'pdf_editor_sessions_v1';

export function loadSessions(): EditorSessionMeta[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EditorSessionMeta[];
  } catch {
    return [];
  }
}

export function saveSessions(list: EditorSessionMeta[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(-100)));
}

export function upsertSession(session: EditorSessionMeta) {
  const list = loadSessions();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) list[idx] = session;
  else list.push(session);
  saveSessions(list);
}

export function deleteSession(id: string) {
  saveSessions(loadSessions().filter((s) => s.id !== id));
}

export function createSession(originalName: string, annotations: Annotation[] = []): EditorSessionMeta {
  const now = new Date().toISOString();
  return {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    originalName,
    createdAt: now,
    updatedAt: now,
    annotations,
    versions: [],
  };
}

const STAMPS_KEY = 'pdf_editor_custom_stamps_v1';
export function loadCustomStamps(): { key: string; label: string; color: string }[] {
  try {
    return JSON.parse(localStorage.getItem(STAMPS_KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveCustomStamps(list: { key: string; label: string; color: string }[]) {
  localStorage.setItem(STAMPS_KEY, JSON.stringify(list));
}