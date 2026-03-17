const RECORDING_FOLDER_DB = "auto-editor-recording-folders";
const RECORDING_FOLDER_STORE = "handles";
const RECORDING_FOLDER_KEY = "recording-folder";
const RECORDING_FOLDER_DB_VERSION = 1;

const supportsIndexedDb = () => typeof window !== "undefined" && "indexedDB" in window;

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const openRecordingFolderDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!supportsIndexedDb()) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }
    const request = indexedDB.open(RECORDING_FOLDER_DB, RECORDING_FOLDER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDING_FOLDER_STORE)) {
        db.createObjectStore(RECORDING_FOLDER_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const supportsRecordingFolderAccess = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

export const saveRecordingFolderHandle = async (handle: any) => {
  if (!supportsIndexedDb() || !handle) return;
  try {
    const db = await openRecordingFolderDb();
    try {
      const tx = db.transaction(RECORDING_FOLDER_STORE, "readwrite");
      const store = tx.objectStore(RECORDING_FOLDER_STORE);
      await requestToPromise(store.put(handle, RECORDING_FOLDER_KEY));
      await waitForTransaction(tx);
    } finally {
      db.close();
    }
  } catch {
    // Ignore persistence failures; auto-import can still work without storage.
  }
};

export const loadRecordingFolderHandle = async (): Promise<any | null> => {
  if (!supportsIndexedDb()) return null;
  try {
    const db = await openRecordingFolderDb();
    try {
      const tx = db.transaction(RECORDING_FOLDER_STORE, "readonly");
      const store = tx.objectStore(RECORDING_FOLDER_STORE);
      const handle = await requestToPromise(store.get(RECORDING_FOLDER_KEY));
      await waitForTransaction(tx);
      return handle ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
};

export const clearRecordingFolderHandle = async () => {
  if (!supportsIndexedDb()) return;
  try {
    const db = await openRecordingFolderDb();
    try {
      const tx = db.transaction(RECORDING_FOLDER_STORE, "readwrite");
      const store = tx.objectStore(RECORDING_FOLDER_STORE);
      await requestToPromise(store.delete(RECORDING_FOLDER_KEY));
      await waitForTransaction(tx);
    } finally {
      db.close();
    }
  } catch {
    // Ignore persistence failures.
  }
};
