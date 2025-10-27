export function filterValidToasts(toasts) {
  if (!Array.isArray(toasts)) {
    return [];
  }

  return toasts.filter((toast) => toast && typeof toast === 'object');
}
