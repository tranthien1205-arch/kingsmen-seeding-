// D1 giả lập bằng node:sqlite — dùng cho test và dev server. Cùng giao diện prepare().bind().first()/all()/run() + batch().
import { DatabaseSync } from 'node:sqlite';
export function taoD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  const norm = a => a.map(v => v === undefined ? null : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, norm(a)),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
  });
  return { raw: db, prepare: sql => stmt(sql), batch: async arr => { for (const s of arr) await s.run(); return []; } };
}
