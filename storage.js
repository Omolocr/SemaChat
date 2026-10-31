/* SemaChat — storage adapters. The whole app state is one JSON document; adapters decide where it lives.
 *   SEMACHAT_DB=/data/semachat.json   -> JSON file (atomic write + .bak copy)       [default]
 *   SEMACHAT_DB=/data/semachat.sqlite -> SQLite via Node's built-in node:sqlite (Node 22+), crash-safe transactions
 * For PostgreSQL (or any other store) implement { kind, load(), save(db), close() } and pass it to server.js.
 */
'use strict';
const fs = require('fs'), path = require('path');

function jsonFile(file) {
  return {
    kind: 'json', file,
    load() { for (const f of [file, file + '.bak']) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* try the backup */ } } return null; },
    save(db) {
      const tmp = file + '.tmp', data = JSON.stringify(db);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(tmp, data); try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (e) { /* backup is best-effort */ }
      fs.renameSync(tmp, file);       // rename is atomic: a crash never leaves a half-written file
    },
    close() {}
  };
}
function sqlite(file) {
  let DatabaseSync; try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { throw new Error('SQLite storage needs Node 22 or newer (node:sqlite). Use a .json file or upgrade Node.'); }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const h = new DatabaseSync(file); h.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, ts INTEGER NOT NULL)');
  const get = h.prepare("SELECT v FROM kv WHERE k='db'"), put = h.prepare("INSERT INTO kv (k, v, ts) VALUES ('db', ?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, ts=excluded.ts");
  return {
    kind: 'sqlite', file,
    load() { const r = get.get(); try { return r ? JSON.parse(r.v) : null; } catch (e) { return null; } },
    save(db) { put.run(JSON.stringify(db), Date.now()); },
    close() { try { h.close(); } catch (e) { /* already closed */ } }
  };
}
exports.open = file => /\.(sqlite3?|db)$/i.test(file) ? sqlite(file) : jsonFile(file);
