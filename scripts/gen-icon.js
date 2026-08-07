const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

let crcTable
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function png(size, draw) {
  const pixels = new Uint8ClampedArray(size * size * 4)
  draw(pixels, size)
  const scanlines = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    scanlines[o++] = 0
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      scanlines[o++] = pixels[i]
      scanlines[o++] = pixels[i + 1]
      scanlines[o++] = pixels[i + 2]
      scanlines[o++] = pixels[i + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = zlib.deflateSync(scanlines)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function disc(pixels, size, cx, cy, radius, r, g, b) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const x = Math.round(cx + dx)
      const y = Math.round(cy + dy)
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      const i = (y * size + x) * 4
      pixels[i] = r
      pixels[i + 1] = g
      pixels[i + 2] = b
      pixels[i + 3] = 255
    }
  }
}

function line(pixels, size, x0, y0, x1, y1, width, r, g, b) {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))
  const radius = width / 2
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps
    disc(pixels, size, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, r, g, b)
  }
}

function draw(pixels, size) {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0x00
    pixels[i + 1] = 0xbf
    pixels[i + 2] = 0xb3
    pixels[i + 3] = 255
  }
  const w = Math.max(2, size * 0.09)
  const pts = [
    [0.12, 0.5],
    [0.42, 0.5],
    [0.52, 0.22],
    [0.62, 0.78],
    [0.72, 0.5],
    [0.88, 0.5],
  ]
  for (let i = 0; i < pts.length - 1; i++) {
    line(
      pixels, size,
      pts[i][0] * size, pts[i][1] * size,
      pts[i + 1][0] * size, pts[i + 1][1] * size,
      w, 255, 255, 255
    )
  }
}

const outDir = path.resolve(__dirname, '..', 'icons')
fs.mkdirSync(outDir, { recursive: true })
for (const size of [128, 48]) {
  const file = path.join(outDir, `${size}.png`)
  fs.writeFileSync(file, png(size, draw))
  console.log(`wrote ${file}`)
}
