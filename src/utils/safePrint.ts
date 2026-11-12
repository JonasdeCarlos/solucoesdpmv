import DOMPurify from 'dompurify';

/** Sanitizes generated print HTML (removes scripts/event handlers) before writing it to a new window. */
export function sanitizePrintHtml(html: string): string {
  return DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style', 'title', 'head', 'meta', 'link'] });
}

export function writeSafe(doc: Document, html: string): void {
  doc.write(sanitizePrintHtml(html));
}
