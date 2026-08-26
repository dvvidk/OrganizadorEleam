// Envoltorio simple de persistencia sobre localStorage.
// Cambia solo este archivo si en el futuro quieres migrar a un backend real
// (por ejemplo Supabase): mantén la misma firma get/set y el resto de la app
// no necesita cambios.
export const storage = {
  async get(key) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? { key, value: v } : null;
    } catch (e) {
      console.error("storage.get error", e);
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      console.error("storage.set error", e);
      return null;
    }
  },
};
