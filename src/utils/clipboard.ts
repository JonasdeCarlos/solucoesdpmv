export async function copyToClipboard(text: string): Promise<boolean> {
  const value = text ?? '';
  if (!value) return false;

  const copyViaEvent = () => {
    let copied = false;
    const handler = (event: ClipboardEvent) => {
      event.clipboardData?.setData('text/plain', value);
      event.preventDefault();
      copied = true;
    };

    document.addEventListener('copy', handler);
    try {
      const ok = document.execCommand('copy');
      return ok && copied;
    } finally {
      document.removeEventListener('copy', handler);
    }
  };

  try {
    if (copyViaEvent()) {
      return true;
    }
  } catch (_) {
    // fall through to other clipboard strategies
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '-1000px';
    ta.style.width = '2px';
    ta.style.height = '2px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch (_) {
    // fall through to async clipboard
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {
    // no-op
  }

  return false;
}