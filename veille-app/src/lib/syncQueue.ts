/**
 * File de mutations offline (IndexedDB).
 *
 * Stocke les requêtes à rejouer quand la connexion revient :
 *   - PATCH /api/observations/:id (statut + commentaire)
 *   - POST /api/sessions (création locale)
 *   - POST /api/photos (multipart — non géré v1, photos uploadées immédiatement)
 *
 * Architecture simple : un object store `mutations` (key autoincrement).
 * Le hook côté shell affiche le nombre en attente ; un bouton « Resynchroniser »
 * dans /sync ou /admin déclenche replayAll().
 */

const DB_NAME = "veille-sync";
const DB_VERSION = 1;
const STORE = "mutations";

type Mutation = {
  id?: number;
  createdAt: number;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  body: unknown;
  /** Hash logique pour idempotence côté serveur. */
  clientGeneratedId?: string;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(mutation: Omit<Mutation, "id" | "createdAt">) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add({
      ...mutation,
      createdAt: Date.now(),
    });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function countPending(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function replayAll(): Promise<{ ok: number; failed: number }> {
  if (typeof indexedDB === "undefined") return { ok: 0, failed: 0 };
  const db = await openDB();
  const all: Mutation[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as Mutation[]);
    req.onerror = () => reject(req.error);
  });
  let ok = 0,
    failed = 0;
  for (const m of all) {
    try {
      const res = await fetch(m.url, {
        method: m.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m.body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Supprime de la file
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).delete(m.id!);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}

/** Wrapper fetch tolérant : si offline, met en file et résout en succès local. */
export async function resilientFetch(
  input: string,
  init: RequestInit
): Promise<Response | "queued"> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (init.method && init.method !== "GET") {
      await enqueue({
        method: init.method as Mutation["method"],
        url: input,
        body:
          typeof init.body === "string" ? JSON.parse(init.body) : init.body,
      });
      return "queued";
    }
  }
  return fetch(input, init);
}
