// The world in one day: Monday 23 November 2026.
//
// A front page drawn entirely in code: no network, no assets, no
// images read from disk. A pixel buffer, a 5x7 bitmap alphabet, a
// handful of shape helpers, and a hand-rolled PNG writer. Because
// nothing here depends on time, randomness, or the environment, two
// runs write byte-identical output. Node 22, standard library only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---- palette ------------------------------------------------------------
const CREAM = [247, 242, 231];
const PAPER = [255, 253, 246];
const INK = [24, 24, 24];
const GREY = [96, 92, 82];
const FAINT = [208, 200, 182];
const RED = [178, 32, 44];
const BLUE = [29, 78, 137];
const SKY = [96, 158, 208];
const TEAL = [18, 110, 105];
const AMBER = [198, 122, 20];
const GOLD = [255, 214, 130];
const DARK = [32, 38, 44];
const STONE = [150, 146, 138];

// ---- pixel buffer -------------------------------------------------------
const px = new Uint8Array(W * H * 3);
function paint(color) {
  for (let i = 0; i < px.length; i += 3) {
    px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2];
  }
}
function dot(x, y, color) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2];
}
function rect(x, y, w, h, color) {
  const x0 = Math.max(0, x), x1 = Math.min(W, x + w);
  const y0 = Math.max(0, y), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) dot(xx, yy, color);
  }
}
function hline(x, y, len, color, thick = 1) { rect(x, y, len, thick, color); }
function vline(x, y, len, color, thick = 1) { rect(x, y, thick, len, color); }
function line(x0, y0, x1, y1, color, thick = 1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  const half = (thick - 1) >> 1;
  for (;;) {
    rect(x - half, y - half, thick, thick, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function polyline(points, color, thick = 1) {
  for (let i = 0; i + 1 < points.length; i++) {
    line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], color, thick);
  }
}
function disc(cx, cy, r, color, filled = true) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (filled ? d <= r : Math.abs(d - r) < 1.3) dot(cx + x, cy + y, color);
    }
  }
}
function ring(cx, cy, r, color) { disc(cx, cy, r, color, false); }
function fillTriangle(ax, ay, bx, by, cx, cy, color) {
  const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
  const minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy);
  const sign = (px0, py0, qx, qy, rx, ry) => (px0 - rx) * (qy - ry) - (qx - rx) * (py0 - ry);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d0 = sign(x, y, ax, ay, bx, by);
      const d1 = sign(x, y, bx, by, cx, cy);
      const d2 = sign(x, y, cx, cy, ax, ay);
      const neg = d0 < 0 || d1 < 0 || d2 < 0;
      const pos = d0 > 0 || d1 > 0 || d2 > 0;
      if (!(neg && pos)) dot(x, y, color);
    }
  }
}
function ellipse(cx, cy, rx, ry, color, filled = true) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const v = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (filled ? v <= 1 : Math.abs(v - 1) < 0.16) dot(cx + x, cy + y, color);
    }
  }
}

// ---- 5x7 bitmap alphabet (all caps, digits, punctuation) ---------------
const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
};

function glyph(ch, x, y, scale, color) {
  const g = GLYPHS[ch] ?? GLYPHS['?'];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (g[row][col] === '1') rect(x + col * scale, y + row * scale, scale, scale, color);
    }
  }
}
function textW(text, scale) { return text.length * 6 * scale - scale; }
function text(text, x, y, scale, color) {
  for (let i = 0; i < text.length; i++) glyph(text[i], x + i * 6 * scale, y, scale, color);
}
function textCentered(str, cx, y, scale, color) {
  text(str, cx - Math.floor(textW(str, scale) / 2), y, scale, color);
}
// Greedy word wrap; returns the number of lines drawn.
function wrapped(str, x, y, maxW, scale, color, gap = 5) {
  const lines = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const trial = cur ? cur + ' ' + word : word;
    if (textW(trial, scale) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => text(ln, x, y + i * (7 * scale + gap), scale, color));
  return lines.length;
}

// ---- story pictures -----------------------------------------------------
function iconGlobe(cx, cy) {
  disc(cx, cy, 38, BLUE);
  disc(cx, cy, 34, SKY);
  ellipse(cx, cy, 30, 13, BLUE, false);
  line(cx - 32, cy - 8, cx + 32, cy + 10, BLUE, 3);
  line(cx - 32, cy + 12, cx + 32, cy - 14, BLUE, 3);
  // The crack: the summit fell apart over one word.
  polyline([[cx + 8, cy - 34], [cx - 2, cy - 8], [cx + 10, cy + 6], [cx + 2, cy + 32]], RED, 3);
}
function iconShield(cx, cy) {
  rect(cx - 28, cy - 32, 56, 34, BLUE);
  fillTriangle(cx - 28, cy + 2, cx + 28, cy + 2, cx, cy + 36, BLUE);
  // Compass star of the alliance.
  line(cx, cy - 24, cx, cy + 24, [255, 255, 255], 3);
  line(cx - 18, cy - 6, cx + 18, cy - 6, [255, 255, 255], 3);
  line(cx - 12, cy - 18, cx + 12, cy + 8, [255, 255, 255], 3);
  line(cx + 12, cy - 18, cx - 12, cy + 8, [255, 255, 255], 3);
  // Incoming objects, stopped short.
  disc(cx - 42, cy - 26, 5, RED);
  disc(cx + 42, cy - 14, 5, RED);
  disc(cx + 40, cy + 28, 5, RED);
}
function iconBlock(cx, cy) {
  // The drone, above the roof but inside the panel.
  rect(cx - 4, cy - 48, 8, 6, DARK);
  line(cx - 26, cy - 46, cx + 26, cy - 46, DARK, 2);
  disc(cx - 28, cy - 48, 6, DARK);
  disc(cx + 28, cy - 48, 6, DARK);
  line(cx, cy - 42, cx, cy - 32, RED, 2);
  // The block: windows lit and dark, one corner broken.
  rect(cx - 32, cy - 32, 64, 64, STONE);
  rect(cx - 32, cy - 32, 64, 7, DARK);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) rect(cx - 25 + c * 15, cy - 17 + r * 15, 10, 10, PAPER);
  }
  rect(cx - 25, cy - 17, 10, 10, INK);
  rect(cx + 5, cy - 2, 10, 10, INK);
  fillTriangle(cx + 32, cy - 32, cx + 32, cy - 8, cx + 12, cy - 32, INK);
}
function iconTanker(cx, cy) {
  rect(cx - 42, cy + 2, 84, 15, DARK);
  fillTriangle(cx + 42, cy + 2, cx + 42, cy + 17, cx + 56, cy + 17, DARK);
  rect(cx - 30, cy - 14, 28, 16, DARK);
  rect(cx + 6, cy - 24, 8, 26, DARK);
  line(cx + 10, cy - 24, cx + 32, cy + 2, DARK, 3);
  // Fire where the mine struck.
  fillTriangle(cx - 20, cy + 2, cx - 8, cy - 20, cx + 4, cy + 2, RED);
  fillTriangle(cx - 11, cy + 2, cx - 6, cy - 10, cx - 1, cy + 2, AMBER);
  hline(cx - 52, cy + 22, 104, BLUE, 3);
  hline(cx - 44, cy + 28, 88, BLUE, 2);
}
function iconBlast(cx, cy) {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(cx, cy, cx + Math.round(Math.cos(a) * 36), cy + Math.round(Math.sin(a) * 36), AMBER, 5);
  }
  disc(cx, cy, 15, RED);
  disc(cx, cy, 7, AMBER);
  rect(cx - 42, cy + 30, 84, 9, DARK);
  hline(cx - 50, cy + 44, 100, BLUE, 3);
}
function iconExam(cx, cy) {
  // The paper.
  rect(cx - 28, cy - 34, 46, 60, PAPER);
  rect(cx - 28, cy - 34, 46, 4, BLUE);
  hline(cx - 20, cy - 22, 30, GREY, 2);
  hline(cx - 20, cy - 10, 30, GREY, 2);
  hline(cx - 20, cy + 2, 30, GREY, 2);
  hline(cx - 20, cy + 14, 30, GREY, 2);
  // The pencil.
  line(cx + 28, cy + 30, cx + 40, cy - 22, AMBER, 6);
  fillTriangle(cx + 40, cy - 22, cx + 46, cy - 34, cx + 34, cy - 28, DARK);
  // The crossed-out answer.
  line(cx - 22, cy + 32, cx + 10, cy + 6, RED, 4);
  line(cx + 10, cy + 32, cx - 22, cy + 6, RED, 4);
}

// ---- page ---------------------------------------------------------------
function panel(x, y, w, h, tag, tagColor, headline, body, place, icon) {
  rect(x, y, w, h, PAPER);
  rect(x, y, w, 4, tagColor);
  hline(x + 16, y + h - 1, w - 32, FAINT, 1);
  vline(x + w - 1, y, h, FAINT, 1);
  vline(x, y, h, FAINT, 1);
  text(tag, x + 16, y + 16, 2, tagColor);
  icon(x + w - 52, y + 58);
  const n = wrapped(headline, x + 16, y + 40, w - 128, 4, INK, 4);
  const bodyY = y + 40 + n * (7 * 4 + 4) + 6;
  wrapped(body, x + 16, bodyY, w - 32, 3, GREY, 5);
  text(place, x + 16, y + h - 28, 2, tagColor);
}

function drawPage() {
  paint(CREAM);
  // Masthead.
  rect(0, 0, W, 150, INK);
  textCentered('THE WORLD IN ONE DAY', W / 2, 24, 6, CREAM);
  textCentered('MONDAY 23 NOVEMBER 2026', W / 2, 70, 4, GOLD);
  hline(48, 116, W - 96, RED, 3);
  textCentered("THE DAY'S NEWS, AT A GLANCE", W / 2, 126, 2, [200, 195, 180]);

  const px0 = 28, pw = (W - 2 * 28 - 18) / 2, py = 168, ph = 222, gap = 14;
  panel(px0, py, pw, ph, 'CLIMATE', TEAL, 'COP31 TALKS COLLAPSE',
    'NO DEAL IN ANTALYA. EU WALKS OUT OVER A TEXT SILENT ON FOSSIL FUELS.',
    'ANTALYA, TURKEY', iconGlobe);
  panel(px0 + pw + 18, py, pw, ph, 'NATO', BLUE, 'NATO MEETS ON POLAND',
    'EMERGENCY TALKS AFTER 3 RUSSIAN MISSILES ENTER POLISH AIRSPACE.',
    'BRUSSELS', iconShield);
  panel(px0, py + ph + gap, pw, ph, 'UKRAINE', RED, 'DYMER: TOLL RISES TO 11',
    'RESCUERS SEARCH THE RUBBLE. KYIV REGION HOLDS A DAY OF MOURNING.',
    'DYMER, UKRAINE', iconBlock);
  panel(px0 + pw + 18, py + ph + gap, pw, ph, 'GULF', RED, 'TANKERS HIT MINES',
    'TWO SUPERTANKERS CATCH FIRE AFTER HITTING MINES EAST OF HORMUZ.',
    'STRAIT OF HORMUZ', iconTanker);
  panel(px0, py + 2 * (ph + gap), pw, ph, 'LIBYA', BLUE, 'SECOND STRIKE OFF BENGHAZI',
    'DRONES HIT A SECOND SHIP OFF LIBYA. THE CORVETTE CAPSIZED.',
    'BENGHAZI, LIBYA', iconBlast);
  panel(px0 + pw + 18, py + 2 * (ph + gap), pw, ph, 'ASIA', AMBER, 'MINISTER QUITS IN SEOUL',
    'MINISTER RESIGNS OVER AI CHEATING IN THE COLLEGE ENTRANCE EXAMS.',
    'SEOUL, SOUTH KOREA', iconExam);

  // Foot strip: the day's other headlines, two columns.
  const fy = py + 3 * (ph + gap) + 4;
  rect(px0, fy, W - 2 * px0, 80, PAPER);
  rect(px0, fy, W - 2 * px0, 3, INK);
  text('MARKETS: TAIWAN BANS SHORT SALES', px0 + 16, fy + 12, 2, INK);
  text('SHARES FELL 17.5% IN A WEEK', px0 + 16, fy + 33, 2, GREY);
  text('UN: 128 STATES BACK ROBOT RULES TALKS', px0 + 16, fy + 54, 2, INK);
  text('INDONESIA FIRE: 24 BODIES FOUND', 548, fy + 12, 2, INK);
  text('NEPAL PM MEETS MODI IN DELHI', 548, fy + 33, 2, GREY);
  text('LIVERPOOL BEAT MAN UTD', 548, fy + 54, 2, GREY);

  // Footer.
  textCentered('AS REPORTED ON 23 NOVEMBER 2026', W / 2, H - 26, 2, GREY);
}

// ---- PNG writer (filter 0, RGB, zlib) ------------------------------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    crc32.table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function writePng() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/entry.png`, png);
  return png.length;
}

drawPage();
const bytes = writePng();
console.log(`wrote entry.png (${bytes} bytes, ${W}x${H})`);
