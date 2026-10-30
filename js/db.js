/* Capa de acceso a IndexedDB. Es el ÚNICO archivo que conoce el almacenamiento.
 * Para añadir tablas o índices: sube DB_VERSION y agrega un bloque `if (old < N)` en migrate(). */
let dbName = 'brother-fit';
const DB_VERSION = 2;

export const STORES = ['exercises', 'workouts', 'sets', 'supplements', 'bodyMetrics', 'meta', 'agentMemory'];

let dbPromise = null;

/* Hay que llamarlo antes de abrir. La página de pruebas usa otro nombre para no tocar los entrenos. */
export function setDbName(name) {
  if (dbPromise) throw new Error('La base ya está abierta.');
  dbName = String(name || 'brother-fit');
}

export async function closeDB() {
  if (!dbPromise) return;
  const conn = await dbPromise;
  conn.close();
  dbPromise = null;
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = (e) => migrate(req.result, e.oldVersion);
    req.onsuccess = () => {
      const conn = req.result;
      conn.onversionchange = () => { conn.close(); dbPromise = null; };
      resolve(conn);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => reject(new Error('Cierra otras pestañas de Brother fit y vuelve a abrir.'));
  });
  return dbPromise;
}

function migrate(db, old) {
  if (old < 1) {
    const ex = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
    ex.createIndex('nombre', 'nombre', { unique: true });

    const w = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
    w.createIndex('fecha', 'fecha');

    const s = db.createObjectStore('sets', { keyPath: 'id', autoIncrement: true });
    s.createIndex('workoutId', 'workoutId');
    s.createIndex('exerciseId', 'exerciseId');

    const sup = db.createObjectStore('supplements', { keyPath: 'id', autoIncrement: true });
    sup.createIndex('fecha', 'fecha');
    sup.createIndex('tipo', 'tipo');

    const bm = db.createObjectStore('bodyMetrics', { keyPath: 'id', autoIncrement: true });
    bm.createIndex('fecha', 'fecha');

    db.createObjectStore('meta', { keyPath: 'key' });
  }
  if (old < 2) {
    const am = db.createObjectStore('agentMemory', { keyPath: 'id', autoIncrement: true });
    am.createIndex('ts', 'ts');
  }
}

/* Ejecuta una operación en una transacción de un store y resuelve al completarse (durabilidad). */
async function run(store, mode, fn) {
  const conn = await openDB();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(store, mode);
    let result;
    const req = fn(tx.objectStore(store));
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = (e) => reject(e.target.error || tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  add: (store, value) => run(store, 'readwrite', (s) => s.add(value)),
  put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
  remove: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
  byIndex: (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value)),

  /* Varias tablas en una sola transacción. fn lanza las peticiones sin esperar
   * y puede devolver un objeto que esas peticiones rellenan antes de cerrar. */
  mutate(stores, fn) {
    return openDB().then((conn) => new Promise((resolve, reject) => {
      const tx = conn.transaction(stores, 'readwrite');
      let box;
      try { box = fn(tx); }
      catch (e) { try { tx.abort(); } catch { /* ya abortada */ } reject(e); return; }
      tx.oncomplete = () => resolve(box);
      tx.onerror = (e) => reject(e.target.error || tx.error);
      tx.onabort = () => reject(tx.error || new Error('No se pudo guardar.'));
    }));
  },

  /* Respaldo: todo el contenido en una sola transacción de lectura. */
  async dumpAll() {
    const conn = await openDB();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(STORES, 'readonly');
      const out = {};
      for (const name of STORES) {
        const r = tx.objectStore(name).getAll();
        r.onsuccess = () => { out[name] = r.result; };
      }
      tx.oncomplete = () => resolve(out);
      tx.onerror = (e) => reject(e.target.error || tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },

  /* Restauración atómica: si algo falla, no se cambia nada. clearAll() = restoreAll({}). */
  async restoreAll(data) {
    const conn = await openDB();
    const availableStores = STORES.filter((s) => conn.objectStoreNames.contains(s));
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(availableStores, 'readwrite');
      for (const name of availableStores) {
        const st = tx.objectStore(name);
        st.clear();
        const rows = Array.isArray(data?.[name]) ? data[name] : [];
        for (const row of rows) st.put(row);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error || tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  clearAll() { return this.restoreAll({}); }
};
