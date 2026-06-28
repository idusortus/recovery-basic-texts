/**
 * Usage logging — anonymous, offline-queued.
 *
 * Enqueues submitted search records in IndexedDB and flushes them to
 * /api/log whenever the app is online.  Logging failure never affects search.
 *
 * Data stored/sent: { q, resultCount, sourceFilter, ts } — no PII.
 *
 * Phase D — PRD §7.4
 */

import type { LogRecord } from '$lib/types';

const DB_NAME = 'basictexts-log';
const STORE_NAME = 'queue';
const DB_VERSION = 1;
const MAX_QUEUE = 100; // FIFO cap — oldest records evicted first

// ─── IDB helpers ─────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { autoIncrement: true });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function getAll(db: IDBDatabase): Promise<{ key: IDBValidKey; record: LogRecord }[]> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const keys: IDBValidKey[] = [];
		const records: LogRecord[] = [];

		const keyCursorReq = store.openKeyCursor();
		const cursorReq = store.openCursor();

		// Collect keys
		const keyPromise = new Promise<void>((res, rej) => {
			const r = store.getAllKeys();
			r.onsuccess = () => {
				keys.push(...r.result);
				res();
			};
			r.onerror = () => rej(r.error);
		});

		// Collect records
		const recPromise = new Promise<void>((res, rej) => {
			const r = store.getAll();
			r.onsuccess = () => {
				records.push(...(r.result as LogRecord[]));
				res();
			};
			r.onerror = () => rej(r.error);
		});

		// Suppress unused variable warnings
		void keyCursorReq;
		void cursorReq;

		Promise.all([keyPromise, recPromise])
			.then(() => resolve(keys.map((key, i) => ({ key, record: records[i] }))))
			.catch(reject);
	});
}

async function deleteKeys(db: IDBDatabase, keys: IDBValidKey[]): Promise<void> {
	if (keys.length === 0) return;
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		keys.forEach((key) => store.delete(key));
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function countRecords(db: IDBDatabase): Promise<number> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const req = store.count();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function deleteOldest(db: IDBDatabase, n: number): Promise<void> {
	if (n <= 0) return;
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		let deleted = 0;
		const req = store.openCursor();
		req.onsuccess = () => {
			const cursor = req.result;
			if (cursor && deleted < n) {
				cursor.delete();
				deleted++;
				cursor.continue();
			} else {
				resolve();
			}
		};
		req.onerror = () => reject(req.error);
	});
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue a search log record.  Safe to call offline — records persist in IDB.
 * If the queue is at capacity, the oldest record is evicted (FIFO).
 */
export async function enqueueLog(
	q: string,
	resultCount: number,
	sourceFilter: string[] | null
): Promise<void> {
	if (typeof indexedDB === 'undefined') return; // SSR guard
	try {
		const db = await openDb();
		const count = await countRecords(db);
		if (count >= MAX_QUEUE) {
			await deleteOldest(db, count - MAX_QUEUE + 1);
		}
		const record: LogRecord = {
			q: q.slice(0, 500),
			resultCount,
			sourceFilter,
			ts: new Date().toISOString()
		};
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).add(record);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch {
		// Logging failure must never affect search UX
	}
}

/**
 * Flush queued records to /api/log.
 * Clears the queue on success; leaves records on failure.
 * Safe to call when offline — the POST will fail silently.
 */
export async function flushLog(): Promise<void> {
	if (typeof indexedDB === 'undefined') return; // SSR guard
	try {
		const db = await openDb();
		const rows = await getAll(db);
		if (rows.length === 0) {
			db.close();
			return;
		}

		const records = rows.map((r) => r.record);
		const res = await fetch('/api/log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(records),
			signal: AbortSignal.timeout(8000)
		});

		if (res.ok) {
			await deleteKeys(
				db,
				rows.map((r) => r.key)
			);
		}
		db.close();
	} catch {
		// Network unavailable or timed out — records stay queued
	}
}
