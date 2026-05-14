type CopySourceElement = HTMLTextAreaElement | HTMLInputElement;

function copyUsingElement(element: CopySourceElement): boolean {
  try {
    element.focus({ preventScroll: true });
    element.select();
    element.setSelectionRange(0, element.value.length);
    return document.execCommand('copy');
  } catch (_) {
    return false;
  }
}

export async function copyToClipboard(text: string, sourceElement?: CopySourceElement | null): Promise<boolean> {
  const value = text ?? '';
  if (!value) return false;

  if (sourceElement && copyUsingElement(sourceElement)) {
    return true;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {
    // fall through to textarea strategy
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0.01';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    const ok = copyUsingElement(ta);
    document.body.removeChild(ta);
    if (ok) return true;
  } catch (_) {
    // no-op
  }

  return false;
}