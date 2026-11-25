// Image sizes from PNG and JPEG headers, and GEDCOM 7.0 CROP regions within them.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

const sized = (width, height) => (width > 0 && height > 0 ? { width, height } : null)

export function imageSize(buf) {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG) && buf.toString('latin1', 12, 16) === 'IHDR') {
    return sized(buf.readUInt32BE(16), buf.readUInt32BE(20))
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let at = 2
  while (at + 4 <= buf.length) {
    if (buf[at] !== 0xff) return null
    const marker = buf[at + 1]
    if (marker === 0xff) {
      at++
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    const len = buf.readUInt16BE(at + 2)
    if (SOF.has(marker)) return at + 9 <= buf.length ? sized(buf.readUInt16BE(at + 7), buf.readUInt16BE(at + 5)) : null
    at += 2 + len
  }
  return null
}

export function cropBox(crop, size) {
  if (!size) return null
  const left = crop.left ?? 0, top = crop.top ?? 0
  const width = Math.min(crop.width ?? Infinity, size.width - left)
  const height = Math.min(crop.height ?? Infinity, size.height - top)
  return width > 0 && height > 0 ? { left, top, width, height } : null
}
