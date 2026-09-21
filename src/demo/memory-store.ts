/**
 * In-memory document store that stands in for Firestore in the demo build.
 *
 * Documents live in a path-keyed map (`trips/abc/members/uid`). Listeners on a
 * document or a collection are notified asynchronously after any write that
 * touches their scope, mirroring the SDK's latency-compensated snapshots.
 * Nothing here persists: closing the tab discards everything.
 */

export type DocData = Record<string, unknown>;
export type Unsubscribe = () => void;

export type WhereOp =
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';

export interface WhereFilter {
  field: string;
  op: WhereOp;
  value: unknown;
}

export interface StoredDoc {
  id: string;
  path: string;
  data: DocData;
}

export type BatchOp =
  | { kind: 'set'; path: string; data: DocData; merge?: boolean }
  | { kind: 'update'; path: string; data: DocData }
  | { kind: 'delete'; path: string };

/** Sentinel for server-side field transforms (`increment`, `arrayUnion`, `arrayRemove`). */
export class FieldTransform {
  private constructor(
    readonly kind: 'increment' | 'arrayUnion' | 'arrayRemove',
    readonly value: unknown,
  ) {}

  static increment(n: number): FieldTransform { return new FieldTransform('increment', n); }
  static arrayUnion(...values: unknown[]): FieldTransform { return new FieldTransform('arrayUnion', values); }
  static arrayRemove(...values: unknown[]): FieldTransform { return new FieldTransform('arrayRemove', values); }

  apply(current: unknown): unknown {
    switch (this.kind) {
      case 'increment':
        return (typeof current === 'number' ? current : 0) + (this.value as number);
      case 'arrayUnion': {
        const list = Array.isArray(current) ? [...current] : [];
        for (const v of this.value as unknown[]) {
          if (!list.some(x => deepEqual(x, v))) list.push(v);
        }
        return list;
      }
      case 'arrayRemove': {
        const list = Array.isArray(current) ? current : [];
        const drop = this.value as unknown[];
        return list.filter(x => !drop.some(v => deepEqual(x, v)));
      }
    }
  }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function isPlainObject(v: unknown): v is DocData {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && Object.getPrototypeOf(v) === Object.prototype;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

/** Resolve transforms and nested maps in `incoming` against `current`. */
function materialize(incoming: unknown, current: unknown): unknown {
  if (incoming instanceof FieldTransform) return incoming.apply(current);
  if (isPlainObject(incoming)) {
    const base = isPlainObject(current) ? current : {};
    const out: DocData = {};
    for (const [k, v] of Object.entries(incoming)) out[k] = materialize(v, base[k]);
    return out;
  }
  return incoming;
}

/** Firestore-style `merge: true`: nested maps merge, everything else replaces. */
function deepMerge(base: DocData, patch: DocData): DocData {
  const out: DocData = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const existing = out[k];
    if (v instanceof FieldTransform) out[k] = v.apply(existing);
    else if (isPlainObject(v)) out[k] = deepMerge(isPlainObject(existing) ? existing : {}, v);
    else out[k] = v;
  }
  return out;
}

function fieldValue(data: DocData, field: string): unknown {
  return field.split('.').reduce<unknown>((acc, key) => (isPlainObject(acc) ? acc[key] : undefined), data);
}

function matches(data: DocData, f: WhereFilter): boolean {
  const v = fieldValue(data, f.field);
  const cmp = (a: unknown, b: unknown) => (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;
  switch (f.op) {
    case '==': return deepEqual(v, f.value);
    case '!=': return !deepEqual(v, f.value);
    case '<':  return v !== undefined && cmp(v, f.value) < 0;
    case '<=': return v !== undefined && cmp(v, f.value) <= 0;
    case '>':  return v !== undefined && cmp(v, f.value) > 0;
    case '>=': return v !== undefined && cmp(v, f.value) >= 0;
    case 'in': return (f.value as unknown[]).some(x => deepEqual(x, v));
    case 'not-in': return !(f.value as unknown[]).some(x => deepEqual(x, v));
    case 'array-contains': return Array.isArray(v) && v.some(x => deepEqual(x, f.value));
    case 'array-contains-any':
      return Array.isArray(v) && (f.value as unknown[]).some(y => v.some(x => deepEqual(x, y)));
  }
}

function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

type DocListener = { path: string; cb: (data: DocData | undefined) => void };
type CollectionListener = { path: string; filters: WhereFilter[]; cb: (docs: StoredDoc[]) => void };

export class MemoryStore {
  private docs = new Map<string, DocData>();
  private docListeners = new Set<DocListener>();
  private collectionListeners = new Set<CollectionListener>();
  private dirty = new Set<string>();
  private pendingInitial = new Set<DocListener | CollectionListener>();
  private flushScheduled = false;

  // ── Reads ──────────────────────────────────────────────────────────────────

  get(path: string): DocData | undefined {
    const d = this.docs.get(path);
    return d ? clone(d) : undefined;
  }

  has(path: string): boolean {
    return this.docs.has(path);
  }

  list(collectionPath: string, filters: WhereFilter[] = []): StoredDoc[] {
    const out: StoredDoc[] = [];
    for (const [path, data] of this.docs) {
      if (parentPath(path) !== collectionPath) continue;
      if (!filters.every(f => matches(data, f))) continue;
      out.push({ id: lastSegment(path), path, data: clone(data) });
    }
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  autoId(): string {
    let id = '';
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
    return id;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  set(path: string, data: DocData, merge = false): void {
    const current = this.docs.get(path);
    const next = merge && current
      ? deepMerge(current, data)
      : (materialize(data, current) as DocData);
    this.docs.set(path, clone(next));
    this.markDirty(path);
  }

  update(path: string, data: DocData): void {
    const current = this.docs.get(path);
    if (!current) throw new Error(`No document to update: ${path}`);
    const next: DocData = { ...current };
    for (const [k, v] of Object.entries(data)) next[k] = materialize(v, current[k]);
    this.docs.set(path, clone(next));
    this.markDirty(path);
  }

  delete(path: string): void {
    if (this.docs.delete(path)) this.markDirty(path);
  }

  batch(ops: BatchOp[]): void {
    for (const op of ops) {
      if (op.kind === 'set') this.set(op.path, op.data, op.merge);
      else if (op.kind === 'update') this.update(op.path, op.data);
      else this.delete(op.path);
    }
  }

  clear(): void {
    const paths = [...this.docs.keys()];
    this.docs.clear();
    paths.forEach(p => this.markDirty(p));
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  watchDoc(path: string, cb: (data: DocData | undefined) => void): Unsubscribe {
    const listener: DocListener = { path, cb };
    this.docListeners.add(listener);
    this.pendingInitial.add(listener);
    this.scheduleFlush();
    return () => { this.docListeners.delete(listener); this.pendingInitial.delete(listener); };
  }

  watchCollection(path: string, filters: WhereFilter[], cb: (docs: StoredDoc[]) => void): Unsubscribe {
    const listener: CollectionListener = { path, filters, cb };
    this.collectionListeners.add(listener);
    this.pendingInitial.add(listener);
    this.scheduleFlush();
    return () => { this.collectionListeners.delete(listener); this.pendingInitial.delete(listener); };
  }

  private markDirty(path: string): void {
    this.dirty.add(path);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    const dirty = this.dirty; this.dirty = new Set();
    const initial = this.pendingInitial; this.pendingInitial = new Set();
    const touchedCollections = new Set([...dirty].map(parentPath));

    for (const l of this.docListeners) {
      if (initial.has(l) || dirty.has(l.path)) l.cb(this.get(l.path));
    }
    for (const l of this.collectionListeners) {
      if (initial.has(l) || touchedCollections.has(l.path)) l.cb(this.list(l.path, l.filters));
    }
  }
}
