const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }
export const esc = s => (s || '').replace(/[&<>"']/g, c => ESCAPES[c])
