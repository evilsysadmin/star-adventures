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

const IDENTITY_TOKEN_URL = 'https://id-staging.shadowops.dpdns.org/api/identity/token';
export const SESSION_RENEW_BEFORE_SECONDS = 45;

async function readAccountSession(response: Response, signal: AbortSignal): Promise<GameStorageScope> {
  if (signal.aborted || response.status !== 200 ||
      response.headers.get('Content-Type')?.toLowerCase().split(';')[0].trim() !== 'application/json') {
    return { mode: 'blocked' };
  }
  const payload: unknown = await response.json();
  if (signal.aborted || !payload || typeof payload !== 'object') return { mode: 'blocked' };
  const session = payload as Record<string, unknown>;
  if (session.identity !== 'staradvs' || !isAccountSubject(session.subject) ||
      !Number.isSafeInteger(session.expires_at) ||
      (session.expires_at as number) <= Date.now() / 1000) {
    return { mode: 'blocked' };
  }
  return { mode: 'account', subject: session.subject, expiresAt: session.expires_at as number };
}

// No browser token is persisted or trusted. Only the edge can authorize
// a new session; expected_subject fences the exchange to the mounted game.
async function renewAccountSession(
  subject: string, request: typeof fetch, signal: AbortSignal, current: () => boolean,
): Promise<GameStorageScope> {
  if (signal.aborted || !current()) return { mode: 'blocked' };
  const central = await request(IDENTITY_TOKEN_URL, {
    method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error',
    headers: { 'Content-Type': 'application/json' }, body: '{}', signal,
  });
  if (signal.aborted || !current() || central.status !== 200 ||
      central.headers.get('Content-Type')?.toLowerCase().split(';')[0].trim() !== 'application/json') {
    return { mode: 'blocked' };
  }
  const payload: unknown = await central.json();
  const token = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).token : null;
  if (signal.aborted || !current() || typeof token !== 'string' || !token || token.length > 8192) {
    return { mode: 'blocked' };
  }
  const exchanged = await request('/api/staradvs/session/renew', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, expected_subject: subject }), signal,
  });
  const next = await readAccountSession(exchanged, signal);
  return current() && next.mode === 'account' && next.subject === subject ? next : { mode: 'blocked' };
}

// Resolve BEFORE the first App render / first checkpoint read. Initial
// bootstrap never exchanges a token; only a bound account may renew.
export async function resolveGameStorageScope(
  origin: string,
  request: typeof fetch = fetch,
  renewal?: { subject: string; current: () => boolean },
): Promise<GameStorageScope> {
  let address: URL;
  try { address = new URL(origin); }
  catch { return { mode: 'blocked' }; }

  const canonical = new URL(STARADVS_PROTECTED_ORIGIN);
  if (protectedPagesAlias(address.hostname)) return { mode: 'blocked' };
  if (address.hostname !== canonical.hostname) return { mode: 'local' };
  if (address.origin !== STARADVS_PROTECTED_ORIGIN) return { mode: 'blocked' };
  if (renewal && (!isAccountSubject(renewal.subject) || !renewal.current())) return { mode: 'blocked' };

  const controller = new AbortController();
  // One bounded budget covers the GET and both renewal requests.
  const deadline = setTimeout(() => controller.abort(), renewal ? 10_000 : 4500);
  try {
    const response = await request('/api/staradvs/session', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: controller.signal,
    });
    if (renewal && response.status === 401) {
      return await renewAccountSession(renewal.subject, request, controller.signal, renewal.current);
    }
    const scope = await readAccountSession(response, controller.signal);
    if (!renewal) return scope;
    // An explicit account switch or an upstream error never triggers exchange.
    if (!renewal.current() || scope.mode !== 'account' || scope.subject !== renewal.subject) return { mode: 'blocked' };
    if (scope.expiresAt - Date.now() / 1000 <= SESSION_RENEW_BEFORE_SECONDS) {
      return await renewAccountSession(renewal.subject, request, controller.signal, renewal.current);
    }
    return scope;
  } catch {
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
  let generation = 0;
  let deadline = Math.min(now() + ACCOUNT_LEASE_MS, expiresAt * 1000);
  return {
    allowed: () => status === 'active' && now() < deadline,
    generation: () => generation,
    pause: () => {
      if (status !== 'revoked') { status = 'paused'; deadline = 0; generation += 1; }
    },
    renew: (next: GameStorageScope): boolean => {
      if (status === 'revoked') return false;
      if (next.mode !== 'account' || next.subject !== subject ||
          !Number.isSafeInteger(next.expiresAt) || next.expiresAt * 1000 <= now()) {
        status = 'revoked'; deadline = 0; generation += 1; return false;
      }
      status = 'active';
      generation += 1;
      deadline = Math.min(now() + ACCOUNT_LEASE_MS, next.expiresAt * 1000);
      return true;
    },
    revoke: () => { status = 'revoked'; deadline = 0; generation += 1; },
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
  const generation = lease.generation();
  const refreshed = await resolveGameStorageScope(origin, request, {
    subject: activeScope.subject,
    current: () => lease === accountLease && lease.generation() === generation,
  });
  // A delayed check cannot reactivate storage after tab suspension/revocation.
  if (lease !== accountLease || lease.generation() !== generation) return false;
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
