const DRAFT_FILE_DATABASE_NAME = 'smart-business-profile-draft-files'
const DRAFT_FILE_DATABASE_VERSION = 1
const DRAFT_FILE_STORE_NAME = 'files'
const MAX_DRAFT_FILE_SIZE_BYTES = 10 * 1024 * 1024

export type CreateProfileDraftFileField =
  | 'logo'
  | 'coverBanner'
  | 'galleryImage'
  | 'productImage'
  | 'qualificationDocument'
  | 'documentFile'

export interface CreateProfileDraftFileScope {
  userId: string
  profileId: string | null
}

export interface CreateProfileDraftFileRecord {
  id: string
  draftKey: string
  userId: string
  profileId: string | null
  fieldKey: CreateProfileDraftFileField
  itemKey: string
  fileName: string
  mimeType: string
  size: number
  lastModified: number
  blob: Blob
  updatedAt: string
}

export interface RestoredCreateProfileDraftFile {
  fieldKey: CreateProfileDraftFileField
  itemKey: string
  file: File
}

export function getCreateProfileDraftFileKey(scope: CreateProfileDraftFileScope): string {
  return `user:${scope.userId}:profile:${scope.profileId ?? 'new'}`
}

function getRecordId(draftKey: string, fieldKey: CreateProfileDraftFileField, itemKey: string): string {
  return `${draftKey}:field:${fieldKey}:item:${itemKey}`
}

function createIndexedDbUnavailableError(): Error {
  return new Error('IndexedDB is not available.')
}

function openDraftFileDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(createIndexedDbUnavailableError())
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_FILE_DATABASE_NAME, DRAFT_FILE_DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DRAFT_FILE_STORE_NAME)) {
        const store = database.createObjectStore(DRAFT_FILE_STORE_NAME, { keyPath: 'id' })
        store.createIndex('draftKey', 'draftKey', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? createIndexedDbUnavailableError())
    request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked.'))
  })
}

function runDraftFileTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDraftFileDatabase().then(
    (database) =>
      new Promise<T | void>((resolve, reject) => {
        const transaction = database.transaction(DRAFT_FILE_STORE_NAME, mode)
        const store = transaction.objectStore(DRAFT_FILE_STORE_NAME)
        let requestResult: T | void

        transaction.oncomplete = () => {
          database.close()
          resolve(requestResult)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
        }

        const request = operation(store)
        if (request) {
          request.onsuccess = () => {
            requestResult = request.result
          }
        }
      })
  )
}

export async function saveCreateProfileDraftFile(
  scope: CreateProfileDraftFileScope,
  fieldKey: CreateProfileDraftFileField,
  itemKey: string,
  file: File
): Promise<void> {
  if (file.size > MAX_DRAFT_FILE_SIZE_BYTES) {
    throw new Error('Draft file is too large to save locally.')
  }

  const draftKey = getCreateProfileDraftFileKey(scope)
  const record: CreateProfileDraftFileRecord = {
    id: getRecordId(draftKey, fieldKey, itemKey),
    draftKey,
    userId: scope.userId,
    profileId: scope.profileId,
    fieldKey,
    itemKey,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
    updatedAt: new Date().toISOString(),
  }

  await runDraftFileTransaction('readwrite', (store) => store.put(record))
  if (import.meta.env.DEV) {
    console.debug('Saved create-profile draft file.', {
      draftKey,
      fieldKey,
      itemKey,
      name: file.name,
      type: file.type,
      size: file.size,
    })
  }
}

export async function removeCreateProfileDraftFile(
  scope: CreateProfileDraftFileScope,
  fieldKey: CreateProfileDraftFileField,
  itemKey: string
): Promise<void> {
  const draftKey = getCreateProfileDraftFileKey(scope)
  await runDraftFileTransaction('readwrite', (store) => store.delete(getRecordId(draftKey, fieldKey, itemKey)))
}

export async function clearCreateProfileDraftFiles(scope: CreateProfileDraftFileScope): Promise<void> {
  const draftKey = getCreateProfileDraftFileKey(scope)
  const records = await listCreateProfileDraftFileRecords(draftKey)

  if (records.length === 0) return

  await runDraftFileTransaction('readwrite', (store) => {
    records.forEach((record) => {
      store.delete(record.id)
    })
  })
}

export async function removeCreateProfileDraftFilesByField(
  scope: CreateProfileDraftFileScope,
  fieldKey: CreateProfileDraftFileField
): Promise<void> {
  const draftKey = getCreateProfileDraftFileKey(scope)
  const records = await listCreateProfileDraftFileRecords(draftKey)
  const matchingRecords = records.filter((record) => record.fieldKey === fieldKey)

  if (matchingRecords.length === 0) return

  await runDraftFileTransaction('readwrite', (store) => {
    matchingRecords.forEach((record) => {
      store.delete(record.id)
    })
  })
}

export async function restoreCreateProfileDraftFiles(
  scope: CreateProfileDraftFileScope
): Promise<RestoredCreateProfileDraftFile[]> {
  const draftKey = getCreateProfileDraftFileKey(scope)
  const records = await listCreateProfileDraftFileRecords(draftKey)

  return records.reduce<RestoredCreateProfileDraftFile[]>((files, record) => {
    if (
      !(record.blob instanceof Blob) ||
      record.size > MAX_DRAFT_FILE_SIZE_BYTES ||
      record.blob.size !== record.size
    ) {
      console.warn('Skipped an invalid create-profile draft file record.', {
        draftKey,
        fieldKey: record.fieldKey,
        itemKey: record.itemKey,
      })
      return files
    }

    const file = new File([record.blob], record.fileName, {
      type: record.mimeType,
      lastModified: record.lastModified,
    })

    files.push({
      fieldKey: record.fieldKey,
      itemKey: record.itemKey,
      file,
    })

    return files
  }, [])
}

async function listCreateProfileDraftFileRecords(draftKey: string): Promise<CreateProfileDraftFileRecord[]> {
  const records = await runDraftFileTransaction<CreateProfileDraftFileRecord[]>('readonly', (store) => {
    const index = store.index('draftKey')
    return index.getAll(draftKey)
  })

  return Array.isArray(records)
    ? records.filter(isCreateProfileDraftFileRecord).sort(compareCreateProfileDraftFileRecords)
    : []
}

function compareCreateProfileDraftFileRecords(
  first: CreateProfileDraftFileRecord,
  second: CreateProfileDraftFileRecord
): number {
  const fieldComparison = first.fieldKey.localeCompare(second.fieldKey)
  if (fieldComparison !== 0) return fieldComparison

  const firstItemIndex = Number(first.itemKey)
  const secondItemIndex = Number(second.itemKey)
  if (Number.isInteger(firstItemIndex) && Number.isInteger(secondItemIndex)) {
    return firstItemIndex - secondItemIndex
  }

  return first.itemKey.localeCompare(second.itemKey)
}

function isCreateProfileDraftFileRecord(value: unknown): value is CreateProfileDraftFileRecord {
  if (!value || typeof value !== 'object') return false

  const record = value as Partial<CreateProfileDraftFileRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.draftKey === 'string' &&
    typeof record.userId === 'string' &&
    (typeof record.profileId === 'string' || record.profileId === null) &&
    isCreateProfileDraftFileField(record.fieldKey) &&
    typeof record.itemKey === 'string' &&
    typeof record.fileName === 'string' &&
    typeof record.mimeType === 'string' &&
    typeof record.size === 'number' &&
    Number.isFinite(record.size) &&
    record.size >= 0 &&
    typeof record.lastModified === 'number' &&
    Number.isFinite(record.lastModified) &&
    record.lastModified >= 0 &&
    record.blob instanceof Blob
  )
}

function isCreateProfileDraftFileField(value: unknown): value is CreateProfileDraftFileField {
  return (
    value === 'logo' ||
    value === 'coverBanner' ||
    value === 'galleryImage' ||
    value === 'productImage' ||
    value === 'qualificationDocument' ||
    value === 'documentFile'
  )
}
