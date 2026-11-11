import { supabase } from './supabase'

const BUCKET = 'dish-photos'
const MAX_SIDE = 1024

/** Shrink a photo to at most 1024 px and re-encode as JPEG to save storage. */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.82),
  )
}

/** Upload into the signed-in user's folder and return the public URL. */
export async function uploadDishPhoto(file: File): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) throw new Error('not signed in')
  const blob = await compressImage(file)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
  })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best-effort cleanup of a photo the user replaced or removed. */
export async function deleteDishPhoto(url: string | null) {
  const marker = `/${BUCKET}/`
  if (!url || !url.includes(marker)) return
  const path = url.slice(url.indexOf(marker) + marker.length)
  if (path.startsWith('recipes/')) return
  await supabase.storage.from(BUCKET).remove([path])
}

/** Base64 payload without the "data:...;base64," prefix. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
