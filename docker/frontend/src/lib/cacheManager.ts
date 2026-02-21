// Cache Manager for storing answer sheet images in IndexedDB
const DB_NAME = "ExamEvaluationDB";
const STORE_NAME = "answerSheets";
const DB_VERSION = 1;

interface CachedPage {
  id: string; // `${subjectCode}-${page}`
  subjectCode: string;
  page: number;
  imageData: Blob;
  timestamp: number;
}

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initializeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const targetDB = (event.target as IDBOpenDBRequest).result;
      if (!targetDB.objectStoreNames.contains(STORE_NAME)) {
        targetDB.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

// Cache a page image
export async function cachePage(
  subjectCode: string,
  page: number,
  imageBlob: Blob
): Promise<void> {
  const database = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const id = `${subjectCode}-${page}`;
    const cachedPage: CachedPage = {
      id,
      subjectCode,
      page,
      imageData: imageBlob,
      timestamp: Date.now(),
    };

    const request = store.put(cachedPage);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get a cached page
export async function getCachedPage(
  subjectCode: string,
  page: number
): Promise<Blob | null> {
  const database = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const id = `${subjectCode}-${page}`;
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result as CachedPage | undefined;
      resolve(result ? result.imageData : null);
    };
  });
}

// Get all cached pages for a subject
export async function getCachedPages(subjectCode: string): Promise<number[]> {
  const database = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result as CachedPage[];
      const pages = results
        .filter((r) => r.subjectCode === subjectCode)
        .map((r) => r.page)
        .sort((a, b) => a - b);
      resolve(pages);
    };
  });
}

// Check if pages are cached
export async function areCachedPages(
  subjectCode: string,
  pages: number[]
): Promise<boolean[]> {
  const cachedPages = await getCachedPages(subjectCode);
  return pages.map((p) => cachedPages.includes(p));
}

// Clear all cache for a subject
export async function clearCache(subjectCode: string): Promise<void> {
  const database = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result as CachedPage[];
      const toDelete = results.filter((r) => r.subjectCode === subjectCode);

      toDelete.forEach((item) => {
        store.delete(item.id);
      });

      resolve();
    };
  });
}

// Get total cache size
export async function getCacheSize(): Promise<number> {
  const database = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result as CachedPage[];
      const totalSize = results.reduce((sum, item) => sum + item.imageData.size, 0);
      resolve(totalSize);
    };
  });
}
