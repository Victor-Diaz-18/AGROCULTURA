/**
 * What the phone keeps on its own (F10), in IndexedDB:
 *  - `borrador`: the story the person is telling right now, one per narrator, so closing the page loses nothing;
 *  - `cola`: stories that are finished but could not be sent yet (no signal), waiting for the signal;
 *  - `cache`: the last answers of the server (configuration, published stories, the narrator's own list),
 *    so the app opens and shows something without a connection.
 *
 * IndexedDB can be missing or blocked (private mode, some embedded browsers). Then everything keeps working in
 * memory for as long as the page stays open, and `deviceStorage()` says it is not durable so the screens never
 * promise more than they can keep.
 *
 * Photos and audio are stored as bytes + type, not as Blob objects: older Safari versions lose Blobs kept in IndexedDB.
 */

import { openDB } from 'idb'

const DB_NAME = 'agrocultura'
const DB_VERSION = 1
const WORKING = 'borrador'
const QUEUE = 'cola'
const CACHE = 'cache'

const memory = { [WORKING]: new Map(), [QUEUE]: new Map(), [CACHE]: new Map() }
let dbPromise = null
let durable = null // null until the first attempt to open

// Writes in flight. A read waits for them, so what was just saved (say, as the person left the page) is what comes back;
// and a test waits for them before it wipes the phone, so a late write cannot land in the next test.
const writing = new Set()
function track(promise) {
  writing.add(promise)
  const forget = () => writing.delete(promise)
  promise.then(forget, forget)
  return promise
}
const afterWrites = async () => {
  while (writing.size > 0) await Promise.allSettled([...writing])
}

function open() {
  if (!dbPromise) {
    const opening =
      typeof indexedDB === 'undefined'
        ? Promise.reject(new Error('IndexedDB is not available'))
        : openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
              db.createObjectStore(WORKING) // key: narrator id
              db.createObjectStore(QUEUE, { keyPath: 'clientId' })
              db.createObjectStore(CACHE) // key: a name like "portal"
            },
          })
    dbPromise = opening
      .then((db) => {
        durable = true
        return db
      })
      .catch(() => {
        durable = false
        return null // memory only
      })
  }
  return dbPromise
}

async function read(store, key) {
  const db = await open()
  return db ? db.get(store, key) : memory[store].get(key)
}

async function readAll(store) {
  const db = await open()
  return db ? db.getAll(store) : [...memory[store].values()]
}

/** `key` is only for stores without a key inside the value (the queue's key is its `clientId`). */
async function write(store, value, key) {
  const db = await open()
  if (db) await db.put(store, value, key)
  else memory[store].set(key ?? value.clientId, value)
}

async function erase(store, key) {
  const db = await open()
  if (db) await db.delete(store, key)
  else memory[store].delete(key)
}

/** True when what is saved survives closing the page. */
export async function deviceStorage() {
  await open()
  return durable === true
}

// ---------- Blobs as bytes ----------

const packed = new WeakMap() // a file is read once, however many times the draft is saved

function pack(blob) {
  let bytes = packed.get(blob)
  if (!bytes) {
    bytes = blob.arrayBuffer().then((buffer) => ({ type: blob.type, buffer }))
    packed.set(blob, bytes)
  }
  return bytes
}

const unpack = ({ type, buffer }) => new Blob([buffer], { type })

/** A draft as it is stored: its files become bytes. */
async function toRecord(draft) {
  return {
    ...draft,
    audio: draft.audio ? { seconds: draft.audio.seconds, mime: draft.audio.mime, data: await pack(draft.audio.blob) } : null,
    fotos: await Promise.all(draft.fotos.map(async ({ id, name, blob }) => ({ id, name, data: await pack(blob) }))),
  }
}

/** The draft back as the form uses it: files are Blobs again. */
function fromRecord(record) {
  return {
    ...record,
    audio: record.audio ? { seconds: record.audio.seconds, mime: record.audio.mime, blob: unpack(record.audio.data) } : null,
    fotos: record.fotos.map(({ id, name, data }) => ({ id, name, blob: unpack(data) })),
  }
}

/** For lists: everything but the bytes. */
function summaryOf(record) {
  const { audio, fotos, ...rest } = record
  return { ...rest, tieneAudio: Boolean(audio), cantidadFotos: fotos.length }
}

// ---------- The story being told ----------

export const saveWorkingDraft = (narratorId, draft) =>
  track(toRecord(draft).then((record) => write(WORKING, { ...record, narratorId }, narratorId)))

/** The draft of this narrator, or null. */
export async function loadWorkingDraft(narratorId) {
  await afterWrites()
  const record = await read(WORKING, narratorId)
  return record ? fromRecord(record) : null
}

export const clearWorkingDraft = (narratorId) => track(erase(WORKING, narratorId))

// ---------- Stories waiting for the signal ----------

/** `item`: the finished draft plus { narratorId, guardadoEn, formatos, subidos, fallo }. Rejects if it could not be saved. */
export const queueStory = (item) => track(toRecord(item).then((record) => write(QUEUE, record)))

/** The waiting stories of one narrator, oldest first, without their files. */
export async function listQueued(narratorId) {
  await afterWrites()
  const records = await readAll(QUEUE)
  return records
    .filter((record) => record.narratorId === narratorId)
    .sort((a, b) => a.guardadoEn.localeCompare(b.guardadoEn))
    .map(summaryOf)
}

/** One waiting story with its files, ready to send. */
export async function getQueued(clientId) {
  await afterWrites()
  const record = await read(QUEUE, clientId)
  return record ? fromRecord(record) : null
}

/** Changes notes of a waiting story (what already went up, why it failed) without touching its files. */
export const updateQueued = (clientId, patch) =>
  track(
    read(QUEUE, clientId).then((record) => {
      if (record) return write(QUEUE, { ...record, ...patch })
      return undefined
    }),
  )

export const removeQueued = (clientId) => track(erase(QUEUE, clientId))

// ---------- Last answers of the server ----------
// A cache is a convenience: it never fails the caller.

export const cacheSet = (key, value) =>
  track(
    write(CACHE, value, key).catch(() => {
      /* without the cache the app just asks again when there is signal */
    }),
  )

export async function cacheGet(key) {
  try {
    await afterWrites()
    return (await read(CACHE, key)) ?? null
  } catch {
    return null
  }
}

export const cacheDelete = (key) =>
  track(
    erase(CACHE, key).catch(() => {
      /* nothing to forget */
    }),
  )

// ---------- Tests ----------

/** Back to an empty phone. */
export async function resetStoreForTests() {
  await afterWrites()
  const db = dbPromise ? await dbPromise : null
  db?.close()
  dbPromise = null
  durable = null
  Object.values(memory).forEach((map) => map.clear())
  if (typeof indexedDB === 'undefined') return
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
}

/** A phone where IndexedDB cannot be used: everything stays in memory. */
export function breakStoreForTests() {
  dbPromise = Promise.resolve(null)
  durable = false
}
