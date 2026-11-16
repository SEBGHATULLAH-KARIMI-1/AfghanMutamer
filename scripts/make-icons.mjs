// ساخت آیکون‌های PWA (بدون نیاز به هیچ پکیج) — قبل از dev و build خودکار اجرا می‌شود
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GREEN = [15, 81, 50]
const GOLD = [212, 175, 55]

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// u و v بین ۰ و ۱؛ هلال طلایی و یک ستاره‌ی کوچک روی زمینه‌ی سبز
function colorAt(u, v) {
  const d = (cx, cy) => Math.hypot(u - cx, v - cy)
  const crescent = d(0.5, 0.5) < 0.27 && d(0.6, 0.46) >= 0.23
  const star = d(0.7, 0.37) < 0.045
  return crescent || star ? GOLD : GREEN
}

function makePng(size) {
  const SS = 3 // نرم‌کردن لبه‌ها
  const rowLen = size * 3 + 1
  const raw = Buffer.alloc(rowLen * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * rowLen] = 0
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
          r += c[0]; g += c[1]; b += c[2]
        }
      }
      const n = SS * SS
      const o = y * rowLen + 1 + x * 3
      raw[o] = Math.round(r / n)
      raw[o + 1] = Math.round(g / n)
      raw[o + 2] = Math.round(b / n)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // عمق بیت
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'icon-192.png'), makePng(192))
writeFileSync(join(out, 'icon-512.png'), makePng(512))
writeFileSync(join(out, 'apple-touch-icon.png'), makePng(180))
console.log('PWA icons created in public/icons')
