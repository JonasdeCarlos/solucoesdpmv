export type AnnotationType =
  | 'comment'
  | 'highlight'
  | 'underline'
  | 'strike'
  | 'text'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'line'
  | 'freehand'
  | 'stamp'
  | 'magnifier';

export interface Point {
  x: number; // normalized 0-1 (page width)
  y: number; // normalized 0-1 (page height)
}

export interface Annotation {
  id: string;
  page: number; // 1-indexed
  type: AnnotationType;
  // Geometric fields (normalized 0-1). Not all used per type.
  x?: number; y?: number; w?: number; h?: number;
  x2?: number; y2?: number;
  points?: Point[]; // freehand / polyline
  // Style
  color?: string;
  fill?: string;
  opacity?: number;
  strokeWidth?: number; // normalized (fraction of min(page w,h))
  fontSize?: number; // normalized
  // Content
  content?: string; // comment / text / stamp label
  stampKind?: string;
  // Magnifier
  magnifier?: {
    src: { x: number; y: number; w: number; h: number };
    zoom: number;
    label?: string;
  };
  // Meta
  author: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EditorSessionMeta {
  id: string;
  originalName: string;
  createdAt: string;
  updatedAt: string;
  annotations: Annotation[];
  versions: { versionNumber: number; savedAt: string; fileName: string }[];
}

export const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', value: '#fff176' },
  { name: 'Verde', value: '#aed581' },
  { name: 'Rosa', value: '#f48fb1' },
  { name: 'Azul', value: '#81d4fa' },
  { name: 'Laranja', value: '#ffb74d' },
];

export const STAMP_PRESETS = [
  { key: 'conferido', label: 'CONFERIDO', color: '#2e7d32' },
  { key: 'revisar', label: 'REVISAR', color: '#ef6c00' },
  { key: 'corrigir', label: 'CORRIGIR', color: '#c62828' },
  { key: 'aprovado', label: 'APROVADO', color: '#1565c0' },
  { key: 'pendente', label: 'PENDENTE', color: '#6a1b9a' },
  { key: 'urgente', label: 'URGENTE', color: '#b71c1c' },
  { key: 'assinado', label: 'ASSINADO', color: '#00695c' },
  { key: 'enviado', label: 'ENVIADO AO CLIENTE', color: '#4527a0' },
];