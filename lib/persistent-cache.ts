/**
 * Persistent cache for lottery results using IndexedDB.
 * Lottery results are immutable — once a contest is drawn, the result never changes.
 * This cache stores results permanently without expiration.
 */

import { LotteryResult } from "./types";

const DB_NAME = "lottery-results-cache";
const DB_VERSION = 1;
const STORE_NAME = "results";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
        store.createIndex("game", "game", { unique: false });
        store.createIndex("contest", "contest", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("[PersistentCache] Failed to open IndexedDB:", request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

interface CachedEntry {
  cacheKey: string;
  game: string;
  contest: number;
  data: LotteryResult;
  cachedAt: number;
}

/**
 * Get a single cached result.
 */
export async function getCachedResult(
  game: string,
  contest: number
): Promise<LotteryResult | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(`${game}/${contest}`);

      request.onsuccess = () => {
        const entry = request.result as CachedEntry | undefined;
        resolve(entry?.data ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store a single result in the persistent cache.
 */
export async function setCachedResult(
  game: string,
  contest: number,
  data: LotteryResult
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const entry: CachedEntry = {
        cacheKey: `${game}/${contest}`,
        game,
        contest,
        data,
        cachedAt: Date.now(),
      };
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently fail — cache is best-effort
  }
}

/**
 * Get the most recent cached contest number for a game within a range.
 * Scans all cached entries for the game and returns the highest contest
 * number that falls within [startContest, endContest].
 */
export async function getMostRecentCachedContest(
  game: string,
  startContest: number,
  endContest: number
): Promise<number | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("game");
      const request = index.openCursor(IDBKeyRange.only(game));

      let maxContest: number | null = null;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as CachedEntry;
          if (entry.contest >= startContest && entry.contest <= endContest) {
            if (maxContest === null || entry.contest > maxContest) {
              maxContest = entry.contest;
            }
          }
          cursor.continue();
        } else {
          resolve(maxContest);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Get all cached results for a game within a contest range.
 * Returns a Map of contest number -> LotteryResult.
 */
export async function getCachedResultsInRange(
  game: string,
  startContest: number,
  endContest: number
): Promise<Map<number, LotteryResult>> {
  const results = new Map<number, LotteryResult>();

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("game");
      const request = index.openCursor(IDBKeyRange.only(game));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as CachedEntry;
          if (entry.contest >= startContest && entry.contest <= endContest) {
            results.set(entry.contest, entry.data);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => resolve(results);
    });
  } catch {
    return results;
  }
}
