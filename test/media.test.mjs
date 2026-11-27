import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageSize, cropBox } from '../lib/media.mjs'

const u16 = n => [n >> 8, n & 255]
const u32 = n => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]
const png = (w, h) => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32(13), ...Buffer.from('IHDR'),
  ...u32(w), ...u32(h), 8, 2, 0, 0, 0, 0, 0, 0, 0])
const segment = (marker, body) => [0xff, marker, ...u16(body.length + 2), ...body]
const sof = (marker, w, h) => segment(marker, [8, ...u16(h), ...u16(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
// An Exif block whose bytes include FF C0, so only a reader that skips whole segments gets the size right.
const exif = segment(0xe1, [...Buffer.from('Exif\0\0'), 0xff, 0xc0, 0, 17, 8, 0, 9, 0, 9, 0xff, 0xd9])
const oriented = (o, le = false) => {
  const w16 = n => (le ? [n & 255, n >> 8] : u16(n)), w32 = n => (le ? u32(n).reverse() : u32(n))
  return segment(0xe1, [...Buffer.from('Exif\0\0'), ...Buffer.from(le ? 'II' : 'MM'), ...w16(42), ...w32(8),
    ...w16(1), ...w16(0x0112), ...w16(3), ...w32(1), ...w16(o), 0, 0, ...w32(0)])
}
const jpeg = (...segs) => Buffer.from([0xff, 0xd8, ...segs.flat(), 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9])

test('imageSize reads PNG and JPEG headers', () => {
  assert.deepEqual(imageSize(png(1200, 800)), { width: 1200, height: 800 })
  assert.deepEqual(imageSize(jpeg(sof(0xc0, 640, 480))), { width: 640, height: 480 })
  assert.deepEqual(imageSize(jpeg(exif, segment(0xdb, Array(65).fill(1)), sof(0xc2, 3000, 2000))), { width: 3000, height: 2000 })
  assert.deepEqual(imageSize(Buffer.from([0xff, 0xd8, 0xff, 0xff, ...sof(0xc1, 5, 7)])), { width: 5, height: 7 })
})

test('imageSize gives a JPEG its upright size, as browsers show it', () => {
  for (const le of [false, true]) {
    for (const o of [1, 2, 3, 4]) assert.deepEqual(imageSize(jpeg(oriented(o, le), sof(0xc0, 640, 480))), { width: 640, height: 480 }, `${o}`)
    for (const o of [5, 6, 7, 8]) assert.deepEqual(imageSize(jpeg(oriented(o, le), sof(0xc0, 640, 480))), { width: 480, height: 640 }, `${o}`)
  }
  const broken = segment(0xe1, [...Buffer.from('Exif\0\0MM'), 0, 42, ...u32(9999)])
  assert.deepEqual(imageSize(jpeg(broken, sof(0xc0, 640, 480))), { width: 640, height: 480 })
})

const le16 = n => [n & 255, n >> 8]
const riff = (chunk, body) => Buffer.from([...Buffer.from('RIFF'), ...u32(0), ...Buffer.from('WEBP' + chunk), ...u32(body.length).reverse(), ...body])

test('imageSize reads GIF and WebP headers', () => {
  assert.deepEqual(imageSize(Buffer.from([...Buffer.from('GIF89a'), ...le16(320), ...le16(200), 0, 0, 0])), { width: 320, height: 200 })
  assert.deepEqual(imageSize(Buffer.from([...Buffer.from('GIF87a'), ...le16(7), ...le16(9), 0, 0, 0])), { width: 7, height: 9 })
  assert.deepEqual(imageSize(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(1024), ...le16(768)])), { width: 1024, height: 768 })
  const w = 4000 - 1, h = 3000 - 1
  assert.deepEqual(imageSize(riff('VP8L', [0x2f, w & 255, (w >> 8) | ((h & 3) << 6), (h >> 2) & 255, h >> 10])), { width: 4000, height: 3000 })
  assert.deepEqual(imageSize(riff('VP8X', [0, 0, 0, 0, 0x3f, 0x42, 0x0f, 0x7f, 0x84, 0x1e])), { width: 1000000, height: 2000000 })
})

test('imageSize returns null for anything it cannot read', () => {
  for (const buf of [
    Buffer.alloc(0), Buffer.from('GIF89a'), Buffer.from('RIFF\0\0\0\0WEBPVP8 '),
    riff('VP8 ', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), riff('VP8L', [0, 0, 0, 0, 0]), Buffer.from('hello'),
    png(10, 10).subarray(0, 20), png(0, 10),
    jpeg(exif).subarray(0, 12), Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), jpeg(exif),
    Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00]),
  ]) assert.equal(imageSize(buf), null, buf.toString('hex'))
})

const size = { width: 1000, height: 600 }

test('cropBox fills in missing edges the way GEDCOM 7.0 says', () => {
  assert.deepEqual(cropBox({ top: 100, left: 200, width: 300, height: 400 }, size), { left: 200, top: 100, width: 300, height: 400 })
  assert.deepEqual(cropBox({}, size), { left: 0, top: 0, width: 1000, height: 600 })
  assert.deepEqual(cropBox({ left: 700, top: 200 }, size), { left: 700, top: 200, width: 300, height: 400 })
})

test('cropBox clips a crop that runs past the edge, and gives up on one wholly outside', () => {
  assert.deepEqual(cropBox({ left: 900, top: 500, width: 300, height: 300 }, size), { left: 900, top: 500, width: 100, height: 100 })
  assert.equal(cropBox({ left: 1000, top: 0, width: 50, height: 50 }, size), null)
  assert.equal(cropBox({ left: 0, top: 0, width: 0, height: 50 }, size), null)
  assert.equal(cropBox({ top: 10 }, null), null)
})
