export function pageCopyKey(text) { let hash=2166136261; for(const char of String(text)) hash=Math.imul(hash ^ char.charCodeAt(0),16777619); return 'copy_'+(hash>>>0).toString(16); }
