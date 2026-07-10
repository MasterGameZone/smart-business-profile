import { supabase } from './supabase'

const BUSINESS_ASSETS_BUCKET = 'business-assets'
const BUSINESS_DOCUMENTS_BUCKET = 'business-documents'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

type BusinessAssetFolder = 'logo' | 'cover' | 'gallery' | 'documents'

interface BusinessAssetUploadParams {
  file: File
  ownerId: string
  businessProfileId: string
}

interface UploadBusinessAssetParams extends BusinessAssetUploadParams {
  folder: BusinessAssetFolder
  filePrefix: string
}

export interface ImageValidationResult {
  valid: boolean
  error?: string
}

export interface StorageUploadResult {
  path: string
  publicUrl: string
}

export interface StoragePathResult {
  path: string
}

export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, or WebP image.',
    }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image must be 5 MB or smaller.',
    }
  }

  return { valid: true }
}

export function validateDocumentFile(file: File): ImageValidationResult {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
    return {
      valid: false,
      error: 'Please upload a PDF, JPG, PNG, or WebP document.',
    }
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Document must be 10 MB or smaller.',
    }
  }

  return { valid: true }
}

function assertValidImageFile(file: File): void {
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.')
  }
}

function assertValidDocumentFile(file: File): void {
  const validation = validateDocumentFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid document file.')
  }
}

function fileExtensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf'
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return Math.random().toString(36).slice(2)
}

function buildBusinessAssetPath({
  file,
  ownerId,
  businessProfileId,
  folder,
  filePrefix,
}: UploadBusinessAssetParams): string {
  const extension = fileExtensionForMimeType(file.type)
  const fileName = `${filePrefix}-${Date.now()}-${randomSuffix()}.${extension}`

  return [
    'business-profiles',
    safePathSegment(ownerId),
    safePathSegment(businessProfileId),
    folder,
    fileName,
  ].join('/')
}

export function getPublicAssetUrl(path: string): string {
  const { data } = supabase.storage.from(BUSINESS_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function uploadBusinessAsset(params: UploadBusinessAssetParams): Promise<StorageUploadResult> {
  assertValidImageFile(params.file)

  const path = buildBusinessAssetPath(params)
  const { error } = await supabase.storage
    .from(BUSINESS_ASSETS_BUCKET)
    .upload(path, params.file, {
      cacheControl: '3600',
      contentType: params.file.type,
      upsert: false,
    })

  if (error) {
    throw error
  }

  return {
    path,
    publicUrl: getPublicAssetUrl(path),
  }
}

export function uploadBusinessLogo(params: BusinessAssetUploadParams): Promise<StorageUploadResult> {
  return uploadBusinessAsset({
    ...params,
    folder: 'logo',
    filePrefix: 'logo',
  })
}

export function uploadBusinessCover(params: BusinessAssetUploadParams): Promise<StorageUploadResult> {
  return uploadBusinessAsset({
    ...params,
    folder: 'cover',
    filePrefix: 'cover',
  })
}

export function uploadBusinessGalleryImage(params: BusinessAssetUploadParams): Promise<StorageUploadResult> {
  return uploadBusinessAsset({
    ...params,
    folder: 'gallery',
    filePrefix: 'gallery',
  })
}

export async function removeBusinessAsset(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUSINESS_ASSETS_BUCKET).remove([path])

  if (error) {
    throw error
  }
}

export async function uploadBusinessDocument(params: BusinessAssetUploadParams): Promise<StoragePathResult> {
  assertValidDocumentFile(params.file)

  const path = buildBusinessAssetPath({
    ...params,
    folder: 'documents',
    filePrefix: 'document',
  })
  const { error } = await supabase.storage
    .from(BUSINESS_DOCUMENTS_BUCKET)
    .upload(path, params.file, {
      cacheControl: '3600',
      contentType: params.file.type,
      upsert: false,
    })

  if (error) {
    throw error
  }

  return { path }
}

export async function removeBusinessDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUSINESS_DOCUMENTS_BUCKET).remove([path])

  if (error) {
    throw error
  }
}
