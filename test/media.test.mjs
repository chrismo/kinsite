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
const jpeg = (...segs) => Buffer.from([0xff, 0xd8, ...segs.flat(), 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9])

test('imageSize reads PNG and JPEG headers', () => {
  assert.deepEqual(imageSize(png(1200, 800)), { width: 1200, height: 800 })
  assert.deepEqual(imageSize(jpeg(sof(0xc0, 640, 480))), { width: 640, height: 480 })
  assert.deepEqual(imageSize(jpeg(exif, segment(0xdb, Array(65).fill(1)), sof(0xc2, 3000, 2000))), { width: 3000, height: 2000 })
  assert.deepEqual(imageSize(Buffer.from([0xff, 0xd8, 0xff, 0xff, ...sof(0xc1, 5, 7)])), { width: 5, height: 7 })
})

test('imageSize returns null for anything it cannot read', () => {
  for (const buf of [
    Buffer.alloc(0), Buffer.from('GIF89a not a png or jpeg'), Buffer.from('hello'),
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
