// One authenticated identity owns one independent set of browser checkpoints.
// The public/offline game keeps its existing unprefixed keys for compatibility.
// Legacy saves have no proven owner and must NEVER be silently adopted by SSO.
export const STARADVS_PROTECTED_ORIGIN = 'https://staging.staradvs.shadowops.dpdns.org';
const USER_PREFIX = 'shadowops.star-adventures.account.v1.';
const SUBJECT_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type GameStorageScope =
  | { mode: 'local' }
  | { mode: 'account'; subject: string }
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
    return { mode: 'account', subject: session.subject };
  } catch {
    // Never fall back to somebody else's unscoped save if Identity is down.
    return { mode: 'blocked' };
  } finally {
    clearTimeout(deadline);
  }
}

// All operations, including iteration and clear(), are restricted to this
// subject's prefix. Other users and legacy keys remain byte-for-byte intact.
export function createAccountStorage(backing: Storage, subject: string): Storage {
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
  return {
    get length() { return names().length; },
    key(index: number) {
      if (!Number.isInteger(index) || index < 0) return null;
      const found = names()[index];
      return found === undefined ? null : found.slice(prefix.length);
    },
    getItem(key: string) { return backing.getItem(prefix + String(key)); },
    setItem(key: string, value: string) { backing.setItem(prefix + String(key), String(value)); },
    removeItem(key: string) { backing.removeItem(prefix + String(key)); },
    clear() { for (const key of names()) backing.removeItem(key); },
  };
}

// The binding is one-shot per page load. A different account must start a
// new page/bootstrap, never repoint a live campaign's storage at another user.
let activeScope: GameStorageScope | null = null;
export function bindGameStorageScope(scope: GameStorageScope): boolean {
  if (activeScope !== null || scope.mode === 'blocked' ||
      (scope.mode === 'account' && !isAccountSubject(scope.subject))) return false;
  activeScope = scope;
  return true;
}

export function activeAccountSubject(): string | null {
  return activeScope?.mode === 'account' ? activeScope.subject : null;
}

export function gameStorageOrNull(): Storage | null {
  if (!activeScope || activeScope.mode === 'blocked') return null;
  try {
    const backing = window.localStorage;
    return activeScope.mode === 'local' ? backing : createAccountStorage(backing, activeScope.subject);
  } catch { return null; }
}
