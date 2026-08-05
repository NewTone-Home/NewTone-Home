export const ADMIN_PREVIEW_STORAGE_KEY = 'newtone-owner-reader-preview-v1'

export function writeAdminPreview(content, storage = sessionStorage) {
  storage.setItem(ADMIN_PREVIEW_STORAGE_KEY, JSON.stringify(content))
}

export function readAdminPreview(storage = sessionStorage) {
  const raw = storage.getItem(ADMIN_PREVIEW_STORAGE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
