// Gera os ícones PNG do PWA (triângulo Vértice) sem dependências externas.
// Uso: node scripts/gen-icons.mjs  →  escreve em public/
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BG = [7, 7, 11];        // #07070b
const FG = [167, 139, 250];   // #a78bfa (accent)

const CRC_TABLE = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(size, px) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// scale < 1 encolhe o triângulo (zona segura do ícone maskable / apple)
function makeIcon(size, scale = 1) {
  const cx = size / 2, cy = size / 2;
  const s = size * 0.36 * scale;
  const A = [cx, cy - s];
  const B = [cx + s * 0.95, cy + s * 0.78];
  const C = [cx - s * 0.95, cy + s * 0.78];
  const half = Math.max(1.4, size * 0.027 * scale);
  const SAMPLES = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];

  return encodePNG(size, (x, y) => {
    let cov = 0;
    for (const [dx, dy] of SAMPLES) {
      const X = x + dx, Y = y + dy;
      const d = Math.min(
        segDist(X, Y, A[0], A[1], B[0], B[1]),
        segDist(X, Y, B[0], B[1], C[0], C[1]),
        segDist(X, Y, C[0], C[1], A[0], A[1]),
      );
      if (d <= half) cov++;
    }
    if (cov === 0) return BG;
    const t = cov / SAMPLES.length;
    return [
      Math.round(BG[0] + (FG[0] - BG[0]) * t),
      Math.round(BG[1] + (FG[1] - BG[1]) * t),
      Math.round(BG[2] + (FG[2] - BG[2]) * t),
    ];
  });
}

const out = (name) => fileURLToPath(new URL('../public/' + name, import.meta.url));
writeFileSync(out('icon-192.png'), makeIcon(192));
writeFileSync(out('icon-512.png'), makeIcon(512));
writeFileSync(out('apple-touch-icon.png'), makeIcon(180, 0.82));
console.log('Ícones gerados em public/: icon-192.png, icon-512.png, apple-touch-icon.png');
