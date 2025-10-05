/**
 * Navigation helpers
 * Provide safe wrappers for view/result toggling without relying on window globals.
 */

function getEl(id) {
    if (typeof document === 'undefined') return null;
    const byId = typeof document.getElementById === 'function' ? document.getElementById(id) : null;
    if (byId) return byId;
    // Fallback to querySelector in test environments where getElementById may be stubbed
    if (typeof document.querySelector === 'function') {
        return document.querySelector(`#${id}`);
    }
    return null;
}

export function switchToComplete() {
    // Prefer globally defined handler if present
    if (typeof window !== 'undefined' && typeof window.switchToComplete === 'function') {
        return window.switchToComplete();
    }
    const upload = getEl('upload-section');
    const complete = getEl('complete-section');
    if (upload) upload.classList.add('hidden');
    if (complete) complete.classList.remove('hidden');
}

export function switchToUpload() {
    if (typeof window !== 'undefined' && typeof window.switchToUpload === 'function') {
        return window.switchToUpload();
    }
    const upload = getEl('upload-section');
    const complete = getEl('complete-section');
    if (complete) complete.classList.add('hidden');
    if (upload) upload.classList.remove('hidden');
}

export function switchToView(viewName) {
    if (typeof window !== 'undefined' && typeof window.switchToView === 'function') {
        return window.switchToView(viewName);
    }
    // Minimal support: currently only 'files' is used in app code
    if (viewName === 'files') {
        showFiles();
    }
}

export function showResults() {
    if (typeof window !== 'undefined' && typeof window.showResults === 'function') {
        return window.showResults();
    }
    const el = getEl('results');
    if (el) el.classList.remove('hidden');
}

export function showFiles() {
    if (typeof window !== 'undefined' && typeof window.showFiles === 'function') {
        return window.showFiles();
    }
    const el = getEl('filesContainer');
    if (el) el.classList.remove('hidden');
}

export function hideProgressCard() {
    if (typeof window !== 'undefined' && typeof window.hideProgressCard === 'function') {
        return window.hideProgressCard();
    }
    const el = getEl('progressCard');
    if (el) el.classList.add('hidden');
}

export function showProgressCard() {
    if (typeof window !== 'undefined' && typeof window.showProgressCard === 'function') {
        return window.showProgressCard();
    }
    const el = getEl('progressCard');
    if (el) el.classList.remove('hidden');
}


