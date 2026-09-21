/**
 * Demo-build stand-in for `@angular/fire/firestore`.
 *
 * `tsconfig.demo.json` maps the real module specifier here, so every service
 * compiles unchanged against this file. It implements exactly the surface the
 * app uses, on top of {@link MemoryStore}. Nothing touches the network.
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { MemoryStore, FieldTransform, WhereFilter, WhereOp, StoredDoc } from './memory-store';

// The SDK types document data as `{ [field: string]: any }`; matching that keeps
// the app's `snap.data() as Foo` casts compiling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocumentData = { [field: string]: any };
export type Unsubscribe = () => void;

/** The one store every `Firestore` instance in the demo reads from. Seeded by `main.demo.ts`. */
export const demoStore = new MemoryStore();

export class Firestore {
  constructor(readonly store: MemoryStore = demoStore) {}
}

export class Query {
  constructor(
    readonly firestore: Firestore,
    readonly path: string,
    readonly filters: WhereFilter[] = [],
  ) {}
}

export class CollectionReference extends Query {
  get id(): string { return this.path.slice(this.path.lastIndexOf('/') + 1); }
}

export class DocumentReference {
  constructor(readonly firestore: Firestore, readonly path: string) {}
  get id(): string { return this.path.slice(this.path.lastIndexOf('/') + 1); }
  get parent(): CollectionReference {
    return new CollectionReference(this.firestore, this.path.slice(0, this.path.lastIndexOf('/')));
  }
}

export class DocumentSnapshot {
  constructor(readonly ref: DocumentReference, private readonly value: DocumentData | undefined) {}
  get id(): string { return this.ref.id; }
  /** Type guard, as in the SDK: after `exists()` passes, `data()` is defined. */
  exists(): this is QueryDocumentSnapshot { return this.value !== undefined; }
  data(): DocumentData | undefined { return this.value; }
}

export class QueryDocumentSnapshot extends DocumentSnapshot {
  constructor(ref: DocumentReference, private readonly docValue: DocumentData) { super(ref, docValue); }
  override data(): DocumentData { return this.docValue; }
}

export class QuerySnapshot {
  constructor(readonly docs: QueryDocumentSnapshot[]) {}
  get empty(): boolean { return this.docs.length === 0; }
  get size(): number { return this.docs.length; }
  forEach(cb: (d: QueryDocumentSnapshot) => void): void { this.docs.forEach(cb); }
}

export interface QueryConstraint { readonly type: 'where'; readonly filter: WhereFilter; }

export interface WriteBatch {
  set(ref: DocumentReference, data: DocumentData, options?: { merge?: boolean }): WriteBatch;
  update(ref: DocumentReference, data: DocumentData): WriteBatch;
  delete(ref: DocumentReference): WriteBatch;
  commit(): Promise<void>;
}

// ── Providers (mirror the SDK's signatures; all inert) ───────────────────────

export function initializeFirestore(_app: unknown, _settings?: unknown): Firestore {
  return new Firestore(demoStore);
}
export function getFirestore(_app?: unknown): Firestore {
  return new Firestore(demoStore);
}
export function persistentLocalCache(_settings?: unknown): Record<string, never> { return {}; }
export function persistentMultipleTabManager(): Record<string, never> { return {}; }
export function provideFirestore(factory: () => Firestore): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: Firestore, useFactory: factory }]);
}

// ── References ───────────────────────────────────────────────────────────────

function joinPath(...segments: string[]): string {
  return segments.filter(s => s.length > 0).join('/');
}

export function collection(parent: Firestore | DocumentReference, path: string, ...rest: string[]): CollectionReference {
  const fs = parent instanceof Firestore ? parent : parent.firestore;
  const base = parent instanceof Firestore ? '' : parent.path;
  return new CollectionReference(fs, joinPath(base, path, ...rest));
}

export function doc(parent: Firestore | CollectionReference, path?: string, ...rest: string[]): DocumentReference {
  if (parent instanceof Firestore) {
    if (!path) throw new Error('doc(): a path is required');
    return new DocumentReference(parent, joinPath(path, ...rest));
  }
  const id = path ?? parent.firestore.store.autoId();
  return new DocumentReference(parent.firestore, joinPath(parent.path, id, ...rest));
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function where(field: string, op: WhereOp, value: unknown): QueryConstraint {
  return { type: 'where', filter: { field, op, value } };
}

export function query(base: Query, ...constraints: QueryConstraint[]): Query {
  return new Query(base.firestore, base.path, [...base.filters, ...constraints.map(c => c.filter)]);
}

function toQuerySnapshot(fs: Firestore, docs: StoredDoc[]): QuerySnapshot {
  return new QuerySnapshot(docs.map(d => new QueryDocumentSnapshot(new DocumentReference(fs, d.path), d.data)));
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  return new DocumentSnapshot(ref, ref.firestore.store.get(ref.path));
}

export async function getDocs(q: Query): Promise<QuerySnapshot> {
  return toQuerySnapshot(q.firestore, q.firestore.store.list(q.path, q.filters));
}

export function onSnapshot(ref: DocumentReference, next: (snap: DocumentSnapshot) => void, error?: (err: Error) => void): Unsubscribe;
export function onSnapshot(q: Query, next: (snap: QuerySnapshot) => void, error?: (err: Error) => void): Unsubscribe;
export function onSnapshot(
  target: DocumentReference | Query,
  next: ((snap: DocumentSnapshot) => void) | ((snap: QuerySnapshot) => void),
  _error?: (err: Error) => void,
): Unsubscribe {
  if (target instanceof DocumentReference) {
    const cb = next as (snap: DocumentSnapshot) => void;
    return target.firestore.store.watchDoc(target.path, data => cb(new DocumentSnapshot(target, data)));
  }
  const cb = next as (snap: QuerySnapshot) => void;
  return target.firestore.store.watchCollection(target.path, target.filters, docs =>
    cb(toQuerySnapshot(target.firestore, docs)));
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function setDoc(ref: DocumentReference, data: DocumentData, options?: { merge?: boolean }): Promise<void> {
  ref.firestore.store.set(ref.path, data, options?.merge === true);
}

export async function updateDoc(ref: DocumentReference, data: DocumentData): Promise<void> {
  ref.firestore.store.update(ref.path, data);
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  ref.firestore.store.delete(ref.path);
}

export async function addDoc(col: CollectionReference, data: DocumentData): Promise<DocumentReference> {
  const ref = doc(col);
  col.firestore.store.set(ref.path, data);
  return ref;
}

export function writeBatch(fs: Firestore): WriteBatch {
  const ops: Parameters<MemoryStore['batch']>[0] = [];
  const batch: WriteBatch = {
    set(ref, data, options) { ops.push({ kind: 'set', path: ref.path, data, merge: options?.merge === true }); return batch; },
    update(ref, data) { ops.push({ kind: 'update', path: ref.path, data }); return batch; },
    delete(ref) { ops.push({ kind: 'delete', path: ref.path }); return batch; },
    async commit() { fs.store.batch(ops); },
  };
  return batch;
}

// ── Field transforms ─────────────────────────────────────────────────────────
// Typed loosely on purpose: the SDK's FieldValue is opaque and the app assigns
// these into fields of typed documents.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function increment(n: number): any { return FieldTransform.increment(n); }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function arrayUnion(...values: unknown[]): any { return FieldTransform.arrayUnion(...values); }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function arrayRemove(...values: unknown[]): any { return FieldTransform.arrayRemove(...values); }
