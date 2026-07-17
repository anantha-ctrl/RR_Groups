// ============================================================
//  Supabase-compatible client backed by the PHP + MySQL API.
//
//  Implements the exact subset of the supabase-js surface this app uses:
//    supabase.from(table).select/insert/update/upsert/delete
//                        .eq/.in/.order/.limit/.single/.maybeSingle  (thenable)
//    supabase.auth.signInWithPassword/signOut/getSession/onAuthStateChange
//    supabase.functions.invoke   (no-op)
//    supabase.channel(...).on(...).subscribe() / removeChannel(...)  (no-op)
//
//  Data queries translate to PostgREST-lite calls against backend/rest.php.
// ============================================================

// API base: use VITE_API_URL if set, otherwise derive from the current host so
// the app works both on localhost AND over the LAN (e.g. a phone hitting
// http://192.168.x.x:5173 will call http://192.168.x.x/RRGroups/backend).
const API_URL =
  (import.meta.env.VITE_API_URL as string) ||
  `${window.location.protocol}//${window.location.hostname}/RRGroups/backend`;
const TOKEN_KEY = 'rrgroups_token';
const SESSION_KEY = 'rrgroups_session';

export interface Session {
  access_token: string;
  user: { id: string; email: string | null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result<T = any> = { data: T; error: { message: string } | null };

// ---------- token / session storage ----------
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function setSessionStore(session: Session | null, token: string | null) {
  if (session && token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ---------- low-level fetch ----------
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}/${path}`, { ...init, headers });
}

async function parseResult<T>(res: Response): Promise<Result<T>> {
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : res.statusText) || 'Request failed';
    return { data: null as unknown as T, error: { message } };
  }
  return { data: (body ?? null) as T, error: null };
}

// Authenticated call to a custom backend endpoint (e.g. users.php).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCall<T = any>(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<Result<T>> {
  const res = await apiFetch(path, {
    method: opts?.method ?? 'GET',
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
  });
  return parseResult<T>(res);
}

// ---------- query builder ----------
type WriteMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private table: string;
  private method: WriteMethod = 'GET';
  private filters: Array<[string, string]> = [];
  private orderClauses: string[] = [];
  private limitVal?: number;
  private body?: unknown;
  private upsert = false;
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string): this {
    // For reads this starts a GET; for writes it just requests the returned rows
    // (the backend already returns them), so no state change is required there.
    if (this.method === 'GET') this.method = 'GET';
    return this;
  }
  insert(payload: unknown): this {
    this.method = 'POST';
    this.body = payload;
    return this;
  }
  upsertRow(payload: unknown): this {
    this.method = 'POST';
    this.upsert = true;
    this.body = payload;
    return this;
  }
  update(payload: unknown): this {
    this.method = 'PATCH';
    this.body = payload;
    return this;
  }
  delete(): this {
    this.method = 'DELETE';
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push([col, `eq.${val ?? ''}`]);
    return this;
  }
  neq(col: string, val: unknown): this {
    this.filters.push([col, `neq.${val ?? ''}`]);
    return this;
  }
  in(col: string, vals: unknown[]): this {
    this.filters.push([col, `in.(${vals.join(',')})`]);
    return this;
  }
  gt(col: string, val: unknown): this { this.filters.push([col, `gt.${val}`]); return this; }
  gte(col: string, val: unknown): this { this.filters.push([col, `gte.${val}`]); return this; }
  lt(col: string, val: unknown): this { this.filters.push([col, `lt.${val}`]); return this; }
  lte(col: string, val: unknown): this { this.filters.push([col, `lte.${val}`]); return this; }

  order(col: string, opts?: { ascending?: boolean }): this {
    const dir = opts?.ascending === false ? 'desc' : 'asc';
    this.orderClauses.push(`${col}.${dir}`);
    return this;
  }
  limit(n: number): this {
    this.limitVal = n;
    return this;
  }
  single(): this {
    this.mode = 'single';
    return this;
  }
  maybeSingle(): this {
    this.mode = 'maybeSingle';
    return this;
  }

  private buildQuery(): string {
    const params = new URLSearchParams();
    params.set('table', this.table);
    for (const [k, v] of this.filters) params.append(k, v);
    if (this.orderClauses.length) params.set('order', this.orderClauses.join(','));
    if (this.limitVal != null) params.set('limit', String(this.limitVal));
    if (this.upsert) params.set('upsert', '1');
    return params.toString();
  }

  private async exec(): Promise<Result<T>> {
    const qs = this.buildQuery();
    const init: RequestInit = { method: this.method };
    if (this.method === 'POST' || this.method === 'PATCH') {
      init.body = JSON.stringify(this.body ?? {});
    }
    const res = await apiFetch(`rest.php?${qs}`, init);
    const result = await parseResult<unknown>(res);
    if (result.error) {
      return { data: null as unknown as T, error: result.error };
    }
    const arr = Array.isArray(result.data) ? result.data : result.data == null ? [] : [result.data];
    if (this.mode === 'single') {
      if (arr.length === 0) {
        return { data: null as unknown as T, error: { message: 'No rows found' } };
      }
      return { data: arr[0] as T, error: null };
    }
    if (this.mode === 'maybeSingle') {
      return { data: (arr[0] ?? null) as T, error: null };
    }
    return { data: arr as unknown as T, error: null };
  }

  // Thenable: enables `await builder` and `builder.then(({data}) => ...)`
  then<TResult1 = Result<T>, TResult2 = never>(
    onfulfilled?: ((value: Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

// upsert() name clashes with reserved word usage; expose proper API below.
interface FromApi<T = any> {
  select(cols?: string): QueryBuilder<T>;
  insert(payload: unknown): QueryBuilder<T>;
  upsert(payload: unknown, opts?: unknown): QueryBuilder<T>;
  update(payload: unknown): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
}

function from<T = any>(table: string): FromApi<T> {
  return {
    select: (cols?: string) => new QueryBuilder<T>(table).select(cols),
    insert: (payload: unknown) => new QueryBuilder<T>(table).insert(payload),
    upsert: (payload: unknown) => new QueryBuilder<T>(table).upsertRow(payload),
    update: (payload: unknown) => new QueryBuilder<T>(table).update(payload),
    delete: () => new QueryBuilder<T>(table).delete(),
  };
}

// ---------- auth ----------
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'INITIAL_SESSION';
type AuthCallback = (event: AuthEvent, session: Session | null) => void;
const authListeners = new Set<AuthCallback>();

function emitAuth(event: AuthEvent, session: Session | null) {
  authListeners.forEach((cb) => cb(event, session));
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await apiFetch('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const result = await parseResult<{ token: string; user: Session['user'] }>(res);
    if (result.error || !result.data) {
      return { data: { user: null, session: null }, error: result.error ?? { message: 'Login failed' } };
    }
    const session: Session = { access_token: result.data.token, user: result.data.user };
    setSessionStore(session, result.data.token);
    emitAuth('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    setSessionStore(null, null);
    emitAuth('SIGNED_OUT', null);
    return { error: null };
  },

  async getSession() {
    return { data: { session: getStoredSession() }, error: null };
  },

  onAuthStateChange(cb: AuthCallback) {
    authListeners.add(cb);
    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(cb);
          },
        },
      },
    };
  },
};

// ---------- functions (push notifications) — no-op in the self-hosted backend ----------
const functions = {
  async invoke(_name: string, _opts?: { body?: unknown }): Promise<Result<null>> {
    return { data: null, error: null };
  },
};

// ---------- realtime — no-op (screens refetch after mutations) ----------
interface ChannelStub {
  on(...args: unknown[]): ChannelStub;
  subscribe(): ChannelStub;
}
function channel(_name: string): ChannelStub {
  const stub: ChannelStub = {
    on: () => stub,
    subscribe: () => stub,
  };
  return stub;
}
function removeChannel(_ch: unknown): void {
  /* no-op */
}

export const supabase = {
  from,
  auth,
  functions,
  channel,
  removeChannel,
};
