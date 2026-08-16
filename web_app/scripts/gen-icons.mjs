// PWA 아이콘 생성 — 의존성 없이 node:zlib로 PNG 인코딩
// 사용: node scripts/gen-icons.mjs  →  public/icon-192.png, public/icon-512.png
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const PALETTE = {
  bg: [0xfa, 0xfa, 0xf9],
  empty: [0xe7, 0xe5, 0xe4],
  blue: [0x3b, 0x82, 0xf6],
  rose: [0xf4, 0x3f, 0x5e],
  violet: [0x8b, 0x5c, 0xf6],
  green: [0x22, 0xc5, 0x5e],
}

// 3x3 미니 히트맵 패턴
const GRID = [
  ['blue', 'violet', 'empty'],
  ['empty', 'blue', 'rose'],
  ['green', 'blue', 'violet'],
]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makePng(size) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
  }
  // 배경
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, PALETTE.bg)
  // 3x3 그리드: 여백 1/8, 셀 간격은 셀의 1/8
  const margin = Math.round(size / 8)
  const inner = size - margin * 2
  const gap = Math.round(inner / 24)
  const cell = Math.floor((inner - gap * 2) / 3)
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const color = PALETTE[GRID[gy][gx]]
      const x0 = margin + gx * (cell + gap)
      const y0 = margin + gy * (cell + gap)
      const r = Math.round(cell / 6) // 라운드 코너
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const cx = x < r ? r - x : x >= cell - r ? x - (cell - r - 1) : 0
          const cy = y < r ? r - y : y >= cell - r ? y - (cell - r - 1) : 0
          if (cx * cx + cy * cy <= r * r || (cx === 0 || cy === 0)) set(x0 + x, y0 + y, color)
        }
      }
    }
  }
  // 스캔라인(필터 0) → zlib
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, makePng(size))
  console.log(`public/icon-${size}.png`)
}
