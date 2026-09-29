// el formato se detecta por los bytes: la extensión y el Content-Type mienten

const FIRMAS: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  { bytes: [0x42, 0x4d], mime: 'image/bmp' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
]

export function mimeRealDeImagen(buffer: Buffer): string | null {
  for (const { bytes, mime } of FIRMAS) {
    if (buffer.length < bytes.length) continue
    if (bytes.every((b, i) => buffer[i] === b)) {
      // RIFF también encabeza .wav y .avi: lo que lo hace WebP son los bytes 8-12
      if (mime === 'image/webp' && buffer.subarray(8, 12).toString('latin1') !== 'WEBP') continue
      return mime
    }
  }
  return null
}

export function empiezaComoImagen(buffer: Buffer): boolean {
  return mimeRealDeImagen(buffer) !== null
}
