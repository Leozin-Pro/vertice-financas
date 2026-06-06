// Global in-memory state — same shape as legacy localStorage STATE.
// Populated from Supabase on login; mutated in memory + written async to DB.

export const STATE = {
  pix: [],
  credit: [],
  people: [],
  customCategories: [],
};

export function hydrate(data) {
  STATE.pix = data.pix || [];
  STATE.credit = data.credit || [];
  STATE.people = data.people || [];
  STATE.customCategories = data.customCategories || [];
}

// UUID v4 — replaces Math.random().toString(36) used in legacy code
export function newId() {
  return crypto.randomUUID();
}
