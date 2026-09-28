export function createReadCache(ttlMs = 30000) {
  const entries = new Map();
  return {
    clear() { entries.clear(); },
    async get(key, load) {
      const existing = entries.get(key);
      if (existing && existing.expires > Date.now()) return existing.promise;
      const entry = { expires: Infinity };
      entry.promise = Promise.resolve().then(load).then((value) => {
        entry.expires = Date.now() + ttlMs;
        return value;
      }, (error) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      if (entries.size >= 200) entries.delete(entries.keys().next().value);
      entries.set(key, entry);
      return entry.promise;
    },
  };
}

export const siteCache = createReadCache();
