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

type AuthResult = {
  ok?: boolean;
  pending?: boolean;
  code?: string;
  error?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  attemptsRemaining?: number | null;
  lockedUntil?: string | null;
};

type PublicProfile = {
  id: string;
  name: string;
  firstName: string;
  role: string;
  department: string;
  initials: string;
  startDate: string;
  hasPin?: boolean;
};

declare global {
  interface Window {
    INTERNTRACK_CONFIG?: RuntimeConfig;
  }
}

const DATA_PREFIX = "it_";

export class PinAuthError extends Error {
  code: string;
  attemptsRemaining: number | null;
  lockedUntil: string | null;

  constructor(message: string, code = "AUTH_ERROR", attemptsRemaining: number | null = null, lockedUntil: string | null = null) {
    super(message);
    this.name = "PinAuthError";
    this.code = code;
    this.attemptsRemaining = attemptsRemaining;
    this.lockedUntil = lockedUntil;
  }
}

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
 * Google Sheets-only state adapter with PIN-gated, per-profile access.
 *
 * Before authentication, only the public profile picker is held in memory.
 * A successful backend PIN check creates a temporary server session and loads
 * only the authenticated profile's records. The token and data are never
 * persisted in localStorage, sessionStorage, IndexedDB, or cookies.
 */
class GoogleSheetsStorage {
  private memory = new Map<string, string>();
  private pending = new Map<string, SyncChange>();
  private flushTimer: number | null = null;
  private flushPromise: Promise<void> | null = null;
  private bootstrapPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string[]> | null = null;
  private listeners = new Set<StorageListener>();
  private sessionToken: string | null = null;
  private activeUserId: string | null = null;
  private sessionExpiresAt: string | null = null;

  getItem(key: string): string | null {
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const normalized = String(value);
    const previous = this.memory.get(key);
    this.memory.set(key, normalized);
    if (!isSyncKey(key) || previous === normalized || !this.sessionToken) return;

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
    if (!isSyncKey(key) || !existed || !this.sessionToken) return;

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

  async unlockProfile(userId: string, pin: string, claimPin: boolean): Promise<void> {
    this.requireConfigured();
    const result = await this.postAuthAction({
      action: claimPin ? "claim_pin" : "verify_pin",
      workspaceId: config().workspaceId,
      userId,
      pin,
    });
    await this.activateSession(userId, result);
  }

  async registerProfile(profile: PublicProfile, pin: string): Promise<void> {
    this.requireConfigured();
    const result = await this.postAuthAction({
      action: "register_profile",
      workspaceId: config().workspaceId,
      sessionToken: this.sessionToken,
      profile,
      pin,
    });
    await this.activateSession(profile.id, result);
  }

  async signOut(): Promise<void> {
    const token = this.sessionToken;
    try {
      if (token) {
        await this.postAuthAction({
          action: "sign_out",
          workspaceId: config().workspaceId,
          sessionToken: token,
        });
      }
    } catch (error) {
      console.warn("InternTrack could not revoke the server session; local access was still cleared.", error);
    } finally {
      this.clearSession();
      await this.bootstrapInternal();
      this.notify(["it_users"]);
    }
  }

  async refresh(): Promise<string[]> {
    this.requireConfigured();
    this.requireAuthenticated();
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refreshInternal().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  async syncNow(): Promise<void> {
    this.requireConfigured();
    this.requireAuthenticated();
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

  isAuthenticated(): boolean {
    return Boolean(this.sessionToken && this.activeUserId);
  }

  private requireConfigured(): void {
    if (!apiIsConfigured()) {
      throw new Error("Google Sheets is not configured. Add the Apps Script /exec URL in config.js.");
    }
  }

  private requireAuthenticated(): void {
    if (!this.sessionToken || !this.activeUserId) {
      throw new PinAuthError("Enter your PIN to continue.", "SESSION_REQUIRED");
    }
  }

  private async bootstrapInternal(): Promise<void> {
    this.requireConfigured();
    const profiles = await this.fetchProfiles();
    this.memory.clear();
    this.pending.clear();
    this.memory.set("it_users", JSON.stringify(profiles));
  }

  private async activateSession(userId: string, result: AuthResult): Promise<void> {
    if (!result.sessionToken) throw new PinAuthError("The backend did not create a secure session.", "SESSION_ERROR");
    this.sessionToken = result.sessionToken;
    this.activeUserId = userId;
    this.sessionExpiresAt = result.sessionExpiresAt || null;
    try {
      const remote = await this.fetchRemoteDump();
      this.replaceMemory(remote);
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  private clearSession(): void {
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.sessionToken = null;
    this.activeUserId = null;
    this.sessionExpiresAt = null;
    this.pending.clear();
    this.memory.clear();
  }

  private replaceMemory(remote: Record<string, RemoteRecord>): void {
    this.memory.clear();
    this.pending.clear();
    Object.entries(remote).forEach(([key, record]) => {
      if (!isSyncKey(key) || record.deleted) return;
      this.memory.set(key, record.value || "");
    });
  }

  private async refreshInternal(): Promise<string[]> {
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
    if (!apiIsConfigured() || !this.sessionToken) return;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch((error) => {
        console.error("InternTrack: Google Sheets write failed; retrying while this page remains open.", error);
        if (!(error instanceof PinAuthError) || !error.code.startsWith("SESSION_")) this.scheduleFlush(2000);
      });
    }, delay);
  }

  private async flush(): Promise<void> {
    this.requireConfigured();
    this.requireAuthenticated();
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

  private async fetchProfiles(): Promise<PublicProfile[]> {
    const payload = await this.fetchJsonp<{ ok?: boolean; profiles?: PublicProfile[]; code?: string; error?: string }>("profiles", {
      workspaceId: config().workspaceId,
    });
    return Array.isArray(payload.profiles) ? payload.profiles : [];
  }

  private async fetchRemoteDump(): Promise<Record<string, RemoteRecord>> {
    this.requireAuthenticated();
    const payload = await this.fetchJsonp<{
      ok?: boolean;
      data?: Record<string, RemoteRecord>;
      sessionExpiresAt?: string;
      code?: string;
      error?: string;
    }>("dump", {
      workspaceId: config().workspaceId,
      sessionToken: this.sessionToken!,
    });
    this.sessionExpiresAt = payload.sessionExpiresAt || this.sessionExpiresAt;
    return payload.data || {};
  }

  private fetchJsonp<T extends { ok?: boolean; code?: string; error?: string }>(action: string, parameters: Record<string, string>): Promise<T> {
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

      (window as unknown as Record<string, unknown>)[callbackName] = (payload: T) => {
        cleanup();
        if (!payload?.ok) {
          const authPayload = payload as T & AuthResult;
          reject(new PinAuthError(
            payload?.error || "Google Sheets returned an error.",
            payload?.code || "REQUEST_ERROR",
            authPayload.attemptsRemaining ?? null,
            authPayload.lockedUntil ?? null,
          ));
          return;
        }
        resolve(payload);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Unable to reach the Google Sheets backend."));
      };

      const url = new URL(cfg.apiUrl!);
      url.searchParams.set("action", action);
      Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", String(Date.now()));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  private async postAuthAction(body: Record<string, unknown>): Promise<AuthResult> {
    const cfg = config();
    const requestId = this.newRequestId();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
    try {
      await fetch(cfg.apiUrl!, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...body, requestId }),
        mode: "no-cors",
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }

    const delays = [0, 100, 180, 320, 560, 900, 1400];
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
      const result = await this.fetchJsonp<AuthResult>("auth_result", { requestId });
      if (!result.pending) return result;
    }
    throw new Error("The authentication request timed out. Please try again.");
  }

  private newRequestId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  private async postBatch(changes: SyncChange[]): Promise<void> {
    this.requireAuthenticated();
    const cfg = config();
    const body = JSON.stringify({
      action: "batch",
      workspaceId: cfg.workspaceId,
      sessionToken: this.sessionToken,
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
        const payload = safeParse<{ ok?: boolean; code?: string; error?: string }>(text, {});
        if (!response.ok || payload.ok !== true) {
          throw new PinAuthError(payload.error || `Google Sheets write failed (${response.status}).`, payload.code || "WRITE_ERROR");
        }
      } catch (error) {
        if (controller.signal.aborted || error instanceof PinAuthError) throw error;
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
        if (change.key === "it_users") {
          const submitted = safeParse<PublicProfile[]>(change.value, []);
          const returned = safeParse<PublicProfile[]>(record.value || null, []);
          const ownSubmitted = submitted.find((profile) => profile.id === this.activeUserId);
          const ownReturned = returned.find((profile) => profile.id === this.activeUserId);
          return JSON.stringify(ownSubmitted || null) === JSON.stringify(ownReturned ? { ...ownReturned, hasPin: undefined } : null)
            || ownSubmitted?.id === ownReturned?.id && ownSubmitted?.name === ownReturned?.name && ownSubmitted?.role === ownReturned?.role && ownSubmitted?.department === ownReturned?.department;
        }
        return record.deleted !== true && (record.value || "") === (change.value || "");
      });
      if (confirmed) return;
    }
    throw new Error("Google Sheets did not confirm the latest changes.");
  }
}

export const STORE = new GoogleSheetsStorage();
