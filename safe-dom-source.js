export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeText(value, maxLength = 500) {
  return String(value ?? '').slice(0, Math.max(0, Number(maxLength) || 0));
}

export function setText(element, value, maxLength = 500) {
  if (!element) return element;
  element.textContent = safeText(value, maxLength);
  return element;
}
