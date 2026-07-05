type SyncChange = {
  key: string;
  value: string | null;
  deleted: boolean;
  updatedAt: string;
};

type RemoteRecord = {
  value?: string;
  deleted?: boolean;
  updatedAt?: string;
};

type RuntimeConfig = {
  apiUrl?: string;
  workspaceId?: string;
  syncEnabled?: boolean;
  requestTimeoutMs?: number;
};

type StorageListener = (changedKeys: string[]) => void;

declare global {
  interface Window {
    INTERNTRACK_CONFIG?: RuntimeConfig;
  }
}

const DATA_PREFIX = "it_";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function isSyncKey(key: string): boolean {
  return key.startsWith(DATA_PREFIX);
}

function config(): Required<Pick<RuntimeConfig, "workspaceId" | "requestTimeoutMs">> & RuntimeConfig {
  const supplied = window.INTERNTRACK_CONFIG || {};
  return {
    ...supplied,
    workspaceId: supplied.workspaceId || "interntrack-main",
    requestTimeoutMs: supplied.requestTimeoutMs || 12000,
  };
}

function apiIsConfigured(): boolean {
  const cfg = config();
  return Boolean(
    cfg.syncEnabled !== false &&
    cfg.apiUrl &&
    /^https:\/\/script\.google\.com\/macros\/s\//.test(cfg.apiUrl) &&
    !cfg.apiUrl.includes("PASTE_")
  );
}

/**
 * Google Sheets-only state adapter.
 *
 * Data is held in memory only while the page is open. Nothing is written to
 * localStorage, sessionStorage, IndexedDB, cookies, or any other browser-side
 * persistence. Google Sheets is the sole persistent source of truth.
 */
class GoogleSheetsStorage {
  private memory = new Map<string, string>();
  private pending = new Map<string, SyncChange>();
  private flushTimer: number | null = null;
  private flushPromise: Promise<void> | null = null;
  private bootstrapPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string[]> | null = null;
  private listeners = new Set<StorageListener>();

  getItem(key: string): string | null {
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const normalized = String(value);
    const previous = this.memory.get(key);
    this.memory.set(key, normalized);
    if (!isSyncKey(key) || previous === normalized) return;

    this.pending.set(key, {
      key,
      value: normalized,
      deleted: false,
      updatedAt: isoNow(),
    });
    this.scheduleFlush(40);
  }

  removeItem(key: string): void {
    const existed = this.memory.has(key);
    this.memory.delete(key);
    if (!isSyncKey(key) || !existed) return;

    this.pending.set(key, {
      key,
      value: null,
      deleted: true,
      updatedAt: isoNow(),
    });
    this.scheduleFlush(40);
  }

  subscribe(listener: StorageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async bootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = this.bootstrapInternal().finally(() => {
      this.bootstrapPromise = null;
    });
    return this.bootstrapPromise;
  }

  async refresh(): Promise<string[]> {
    this.requireConfigured();
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refreshInternal().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  async syncNow(): Promise<void> {
    this.requireConfigured();
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    do {
      await this.flush();
    } while (this.pending.size > 0);
  }

  isCloudEnabled(): boolean {
    return apiIsConfigured();
  }

  private requireConfigured(): void {
    if (!apiIsConfigured()) {
      throw new Error("Google Sheets is not configured. Add the Apps Script /exec URL in config.js.");
    }
  }

  private async bootstrapInternal(): Promise<void> {
    this.requireConfigured();
    const remote = await this.fetchRemoteDump();
    this.memory.clear();

    Object.entries(remote).forEach(([key, record]) => {
      if (!isSyncKey(key) || record.deleted) return;
      this.memory.set(key, record.value || "");
    });
  }

  private async refreshInternal(): Promise<string[]> {
    // Finish this page's writes before replacing its in-memory view.
    await this.syncNow();
    const remote = await this.fetchRemoteDump();
    const changedKeys: string[] = [];
    const remoteKeys = new Set<string>();

    Object.entries(remote).forEach(([key, record]) => {
      if (!isSyncKey(key)) return;
      remoteKeys.add(key);
      const previous = this.memory.get(key) ?? null;
      const next = record.deleted ? null : record.value || "";

      if (record.deleted) this.memory.delete(key);
      else this.memory.set(key, next || "");

      if (previous !== next) changedKeys.push(key);
    });

    // The backend normally retains tombstones, but also remove any in-memory
    // key that is no longer represented remotely.
    [...this.memory.keys()].forEach((key) => {
      if (isSyncKey(key) && !remoteKeys.has(key) && !this.pending.has(key)) {
        this.memory.delete(key);
        changedKeys.push(key);
      }
    });

    if (changedKeys.length) this.notify(changedKeys);
    return changedKeys;
  }

  private scheduleFlush(delay = 40): void {
    if (!apiIsConfigured()) return;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch((error) => {
        console.error("InternTrack: Google Sheets write failed; retrying while this page remains open.", error);
        this.scheduleFlush(2000);
      });
    }, delay);
  }

  private async flush(): Promise<void> {
    this.requireConfigured();
    if (this.flushPromise) return this.flushPromise;

    this.flushPromise = this.flushInternal().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async flushInternal(): Promise<void> {
    const changes = [...this.pending.values()];
    if (!changes.length) return;

    await this.postBatch(changes);

    for (const change of changes) {
      if (this.pending.get(change.key)?.updatedAt === change.updatedAt) {
        this.pending.delete(change.key);
      }
    }

    // A change may have arrived while the previous request was running.
    if (this.pending.size) this.scheduleFlush(40);
  }

  private notify(changedKeys: string[]): void {
    const uniqueKeys = [...new Set(changedKeys)];
    this.listeners.forEach((listener) => {
      try {
        listener(uniqueKeys);
      } catch (error) {
        console.warn("InternTrack storage listener failed.", error);
      }
    });
  }

  private fetchRemoteDump(): Promise<Record<string, RemoteRecord>> {
    const cfg = config();
    const callbackName = `__internTrackJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Google Sheets request timed out."));
      }, cfg.requestTimeoutMs);

      const script = document.createElement("script");
      const cleanup = () => {
        window.clearTimeout(timeout);
        script.remove();
        delete (window as unknown as Record<string, unknown>)[callbackName];
      };

      (window as unknown as Record<string, unknown>)[callbackName] = (payload: {
        ok?: boolean;
        data?: Record<string, RemoteRecord>;
        error?: string;
      }) => {
        cleanup();
        if (!payload?.ok) {
          reject(new Error(payload?.error || "Google Sheets returned an error."));
          return;
        }
        resolve(payload.data || {});
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Unable to reach the Google Sheets backend."));
      };

      const url = new URL(cfg.apiUrl!);
      url.searchParams.set("action", "dump");
      url.searchParams.set("workspaceId", cfg.workspaceId);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", String(Date.now()));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  private async postBatch(changes: SyncChange[]): Promise<void> {
    const cfg = config();
    const body = JSON.stringify({
      action: "batch",
      workspaceId: cfg.workspaceId,
      changes,
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
    try {
      try {
        const response = await fetch(cfg.apiUrl!, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body,
          redirect: "follow",
          signal: controller.signal,
        });
        const text = await response.text();
        const payload = safeParse<{ ok?: boolean; error?: string }>(text, {});
        if (!response.ok || payload.ok !== true) {
          throw new Error(payload.error || `Google Sheets write failed (${response.status}).`);
        }
      } catch (error) {
        if (controller.signal.aborted) throw error;
        // Apps Script deployments can omit CORS headers. An opaque POST still
        // reaches doPost; the JSONP read below verifies that Sheets committed it.
        await fetch(cfg.apiUrl!, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body,
          mode: "no-cors",
          redirect: "follow",
          signal: controller.signal,
        });
      }
    } finally {
      window.clearTimeout(timeout);
    }

    await this.verifyChanges(changes);
  }

  private async verifyChanges(changes: SyncChange[]): Promise<void> {
    const attempts = [120, 260, 520, 900];
    for (const delay of attempts) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const remote = await this.fetchRemoteDump();
      const confirmed = changes.every((change) => {
        const record = remote[change.key];
        if (!record) return false;
        if (change.deleted) return record.deleted === true;
        return record.deleted !== true && (record.value || "") === (change.value || "");
      });
      if (confirmed) return;
    }
    throw new Error("Google Sheets did not confirm the latest changes.");
  }
}

export const STORE = new GoogleSheetsStorage();
