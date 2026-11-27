// Image sizes from PNG, JPEG, GIF and WebP headers, and GEDCOM 7.0 CROP regions within them.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

const sized = (width, height) => (width > 0 && height > 0 ? { width, height } : null)

function orientation(buf, at, end) {
  if (buf.toString('latin1', at, at + 6) !== 'Exif\0\0') return 1
  const tiff = at + 6, le = buf.toString('latin1', tiff, tiff + 2) === 'II'
  const u16 = i => (le ? buf.readUInt16LE(i) : buf.readUInt16BE(i)), u32 = i => (le ? buf.readUInt32LE(i) : buf.readUInt32BE(i))
  try {
    const ifd = tiff + u32(tiff + 4)
    for (let i = 0, n = u16(ifd); i < n; i++) {
      const entry = ifd + 2 + i * 12
      if (entry + 12 > end) break
      if (u16(entry) === 0x0112) return u16(entry + 8)
    }
  } catch {}
  return 1
}

function jpegSize(buf) {
  let at = 2, turned = false
  while (at + 4 <= buf.length) {
    if (buf[at] !== 0xff) return null
    const marker = buf[at + 1]
    if (marker === 0xff) {
      at++
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    const len = buf.readUInt16BE(at + 2)
    if (marker === 0xe1) turned ||= orientation(buf, at + 4, at + 2 + len) >= 5
    if (SOF.has(marker)) {
      if (at + 9 > buf.length) return null
      const width = buf.readUInt16BE(at + 7), height = buf.readUInt16BE(at + 5)
      return turned ? sized(height, width) : sized(width, height)
    }
    at += 2 + len
  }
  return null
}

function webpSize(buf) {
  const chunk = buf.toString('latin1', 12, 16)
  if (chunk === 'VP8 ' && buf.length >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
    return sized(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff)
  }
  if (chunk === 'VP8L' && buf.length >= 25 && buf[20] === 0x2f) {
    const bits = buf.readUInt32LE(21)
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
  }
  if (chunk === 'VP8X' && buf.length >= 30) return sized(buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1)
  return null
}

// A JPEG's size is upright, as browsers show it after applying its Exif orientation.
export function imageSize(buf) {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG) && buf.toString('latin1', 12, 16) === 'IHDR') {
    return sized(buf.readUInt32BE(16), buf.readUInt32BE(20))
  }
  if (buf.length >= 10 && /^GIF8[79]a$/.test(buf.toString('latin1', 0, 6))) return sized(buf.readUInt16LE(6), buf.readUInt16LE(8))
  if (buf.length >= 16 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return webpSize(buf)
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf)
  return null
}

export function cropBox(crop, size) {
  if (!size) return null
  const left = crop.left ?? 0, top = crop.top ?? 0
  const width = Math.min(crop.width ?? Infinity, size.width - left)
  const height = Math.min(crop.height ?? Infinity, size.height - top)
  return width > 0 && height > 0 ? { left, top, width, height } : null
}
