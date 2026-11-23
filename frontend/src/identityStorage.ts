// One authenticated identity owns one independent set of browser checkpoints.
// The public/offline game keeps its existing unprefixed keys for compatibility.
// Legacy saves have no proven owner and must NEVER be silently adopted by SSO.
export const STARADVS_PROTECTED_ORIGIN = 'https://staging.staradvs.shadowops.dpdns.org';
const USER_PREFIX = 'shadowops.star-adventures.account.v1.';
const SUBJECT_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type GameStorageScope =
  | { mode: 'local' }
  | { mode: 'account'; subject: string; expiresAt: number }
  | { mode: 'blocked' };

export function isAccountSubject(value: unknown): value is string {
  return typeof value === 'string' && SUBJECT_V4.test(value);
}

function protectedPagesAlias(hostname: string): boolean {
  return hostname === 'staradvs-staging.pages.dev' ||
    /^[a-z0-9-]+\.staradvs-staging\.pages\.dev$/.test(hostname);
}

// Resolve BEFORE the first App render / first checkpoint read. No browser
// token is persisted or trusted; the canonical Worker's same-origin session
// endpoint already enforces JWT signature + live Identity freshness.
export async function resolveGameStorageScope(
  origin: string,
  request: typeof fetch = fetch,
): Promise<GameStorageScope> {
  let address: URL;
  try { address = new URL(origin); }
  catch { return { mode: 'blocked' }; }

  const canonical = new URL(STARADVS_PROTECTED_ORIGIN);
  if (protectedPagesAlias(address.hostname)) return { mode: 'blocked' };
  if (address.hostname !== canonical.hostname) return { mode: 'local' };
  if (address.origin !== STARADVS_PROTECTED_ORIGIN) return { mode: 'blocked' };

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await request('/api/staradvs/session', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: controller.signal,
    });
    if (controller.signal.aborted || response.status !== 200 ||
        response.headers.get('Content-Type')?.toLowerCase().split(';')[0].trim() !== 'application/json') {
      return { mode: 'blocked' };
    }
    const payload: unknown = await response.json();
    if (controller.signal.aborted || !payload || typeof payload !== 'object') return { mode: 'blocked' };
    const session = payload as Record<string, unknown>;
    if (session.identity !== 'staradvs' || !isAccountSubject(session.subject) ||
        !Number.isSafeInteger(session.expires_at) ||
        (session.expires_at as number) <= Date.now() / 1000) {
      return { mode: 'blocked' };
    }
    return { mode: 'account', subject: session.subject, expiresAt: session.expires_at as number };
  } catch {
    // Never fall back to somebody else's unscoped save if Identity is down.
    return { mode: 'blocked' };
  } finally {
    clearTimeout(deadline);
  }
}

// A short, nonrenewable-by-storage local lease limits stale browser tabs.
// Only a fresh, same-subject Worker response can extend it. It is not a
// substitute for the Worker's server-side session freshness authorization.
export const ACCOUNT_LEASE_MS = 45_000;
export function createAccountLease(
  subject: string, expiresAt: number, now: () => number = Date.now,
) {
  if (!isAccountSubject(subject) || !Number.isSafeInteger(expiresAt) ||
      expiresAt * 1000 <= now()) throw new Error('invalid initial Identity session');
  let status: 'active' | 'paused' | 'revoked' = 'active';
  let deadline = Math.min(now() + ACCOUNT_LEASE_MS, expiresAt * 1000);
  return {
    allowed: () => status === 'active' && now() < deadline,
    pause: () => {
      if (status !== 'revoked') { status = 'paused'; deadline = 0; }
    },
    renew: (next: GameStorageScope): boolean => {
      if (status === 'revoked') return false;
      if (next.mode !== 'account' || next.subject !== subject ||
          !Number.isSafeInteger(next.expiresAt) || next.expiresAt * 1000 <= now()) {
        status = 'revoked'; deadline = 0; return false;
      }
      status = 'active';
      deadline = Math.min(now() + ACCOUNT_LEASE_MS, next.expiresAt * 1000);
      return true;
    },
    revoke: () => { status = 'revoked'; deadline = 0; },
  };
}

type AccountLease = ReturnType<typeof createAccountLease>;

// All operations, including iteration and clear(), are restricted to this
// subject's prefix. Cached storage handles also obey the live lease.
export function createAccountStorage(
  backing: Storage, subject: string, allowed: () => boolean = () => true,
): Storage {
  if (!isAccountSubject(subject)) throw new Error('invalid ShadowOps ID subject');
  const prefix = USER_PREFIX + subject + '.';
  const names = () => {
    const result: string[] = [];
    for (let i = 0; i < backing.length; i += 1) {
      const key = backing.key(i);
      if (key?.startsWith(prefix)) result.push(key);
    }
    return result;
  };
  const writable = () => {
    if (!allowed()) throw new Error('ShadowOps ID session is not currently verified');
  };
  return {
    get length() { return allowed() ? names().length : 0; },
    key(index: number) {
      if (!allowed() || !Number.isInteger(index) || index < 0) return null;
      const found = names()[index];
      return found === undefined ? null : found.slice(prefix.length);
    },
    getItem(key: string) { return allowed() ? backing.getItem(prefix + String(key)) : null; },
    setItem(key: string, value: string) { writable(); backing.setItem(prefix + String(key), String(value)); },
    removeItem(key: string) { writable(); backing.removeItem(prefix + String(key)); },
    clear() { writable(); for (const key of names()) backing.removeItem(key); },
  };
}

// The binding is one-shot per page load. A different account must start a
// new page/bootstrap, never repoint a live campaign's storage at another user.
let activeScope: GameStorageScope | null = null;
let accountLease: AccountLease | null = null;
export function bindGameStorageScope(scope: GameStorageScope): boolean {
  if (activeScope !== null || scope.mode === 'blocked') return false;
  if (scope.mode === 'account') {
    try { accountLease = createAccountLease(scope.subject, scope.expiresAt); }
    catch { return false; }
  }
  activeScope = scope;
  return true;
}

export function pauseBoundGameStorage(): void {
  accountLease?.pause();
}

export function revokeBoundGameStorage(): void {
  accountLease?.revoke();
}

export async function revalidateBoundGameStorage(
  origin: string, request: typeof fetch = fetch,
): Promise<boolean> {
  const lease = accountLease;
  if (!lease || activeScope?.mode !== 'account') return false;
  const refreshed = await resolveGameStorageScope(origin, request);
  // A response from another account must never repoint this mounted game.
  if (lease !== accountLease) return false;
  return lease.renew(refreshed);
}

export function activeAccountSubject(): string | null {
  return activeScope?.mode === 'account' && accountLease?.allowed()
    ? activeScope.subject : null;
}

export function gameStorageOrNull(): Storage | null {
  if (!activeScope || activeScope.mode === 'blocked') return null;
  if (activeScope.mode === 'account' && !accountLease?.allowed()) return null;
  try {
    const backing = window.localStorage;
    return activeScope.mode === 'local' ? backing
      : createAccountStorage(backing, activeScope.subject, () => accountLease?.allowed() === true);
  } catch { return null; }
}
