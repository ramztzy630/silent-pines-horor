// Generator tekstur pohon prosedural (murni data, tanpa DOM) - seamless / tileable.

function hash2(a, b, seed) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Value noise periodik (px, py = periode kisi) -> tileable
function noise2(x, y, px, py, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let xf = x - xi, yf = y - yi;
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
  const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  xf = xf * xf * (3 - 2 * xf);
  yf = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

function fbm(u, v, fx, fy, oct, seed) {
  let sum = 0, amp = 0.5, norm = 0, mul = 1;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise2(u * fx * mul, v * fy * mul, fx * mul, fy * mul, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    mul *= 2;
  }
  return sum / norm;
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Height map -> normal map (tileable, konvensi OpenGL +Y)
function heightToNormal(hgt, size, strength) {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (hgt[idx(x - 1, y)] - hgt[idx(x + 1, y)]) * strength;
      const ny = (hgt[idx(x, y + 1)] - hgt[idx(x, y - 1)]) * strength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * size + x) * 4;
      rgba[o] = (nx * inv * 0.5 + 0.5) * 255;
      rgba[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      rgba[o + 2] = (inv * 0.5 + 0.5) * 255;
      rgba[o + 3] = 255;
    }
  }
  return { size, rgba };
}

// Cap elips berulang (wrap) pada array
function stampEllipse(size, cx, cy, rx, ry, fn) {
  const ex = Math.ceil(rx * 1.9), ey = Math.ceil(ry * 1.9);
  for (let dy = -ey; dy <= ey; dy++) {
    for (let dx = -ex; dx <= ex; dx++) {
      const d = (dx / rx) * (dx / rx) + (dy / ry) * (dy / ry);
      if (d > 3.6) continue;
      const x = (((cx + dx) % size) + size) % size;
      const y = (((cy + dy) % size) + size) % size;
      fn(y * size + x, d);
    }
  }
}

export function generateBarkData(size) {
  const sc = size / 512;
  const N = size * size;
  const hgt = new Float32Array(N);
  const dark = new Float32Array(N);   // lubang / mata hitam
  const scar = new Float32Array(N);   // goresan cakar (kayu pucat)
  const stain = new Float32Array(N);  // noda merah kecoklatan

  // --- 1. Height: alur kulit kayu pinus (celah dalam vertikal + lempeng retak) ---
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbm(u, v, 3, 2, 3, 5);
      const uu = (u + (warp - 0.5) * 0.14 + 1) % 1;
      const r = fbm(uu, v, 12, 3, 5, 21);
      const crease = 1 - Math.abs(2 * r - 1);
      // celah tipis & dalam + lereng landai
      let hv = 1 - smooth(0.86, 0.985, crease) * 1.0 - smooth(0.55, 0.86, crease) * 0.30;
      // retak melintang halus memecah lempeng
      const r2 = fbm(uu, v, 9, 34, 4, 43);
      const c2 = 1 - Math.abs(2 * r2 - 1);
      hv -= smooth(0.90, 0.99, c2) * 0.40;
      // tiap lempeng punya ketinggian sedikit berbeda
      hv += 0.18 * (fbm(u, v, 24, 5, 2, 29) - 0.5);
      // kekasaran halus
      hv += 0.26 * (fbm(u, v, 90, 18, 3, 61) - 0.5);
      hv += 0.12 * (fbm(u, v, 220, 44, 2, 83) - 0.5);
      hgt[y * size + x] = hv;
    }
  }
  // Normalisasi dulu (sebelum fitur) agar detail kulit kayu tetap kontras
  {
    let mn0 = 1e9, mx0 = -1e9;
    for (let i = 0; i < N; i++) { if (hgt[i] < mn0) mn0 = hgt[i]; if (hgt[i] > mx0) mx0 = hgt[i]; }
    const rg = mx0 - mn0 || 1;
    for (let i = 0; i < N; i++) hgt[i] = (hgt[i] - mn0) / rg;
  }

  // --- 2. Fitur seram ---
  const rand = rng(1337);
  const hole = (cx, cy, rx, ry, depth) => {
    stampEllipse(size, cx, cy, rx, ry, (i, d) => {
      // tepi bergerigi
      const jag = 1 + 0.18 * Math.sin(i * 0.37) * Math.sin(i * 0.011);
      const dd = d * jag;
      if (dd < 1) {
        const k = 1 - dd;
        hgt[i] -= k * depth;
        dark[i] = Math.max(dark[i], smooth(0, 0.28, k));
      } else if (dd < 2.2) {
        hgt[i] += 0.22 * (1 - (dd - 1) / 1.2);
        dark[i] = Math.max(dark[i], 0.35 * (1 - (dd - 1) / 1.2));
      }
    });
  };

  // Wajah di kulit kayu: dua mata miring + mulut celah panjang
  const faces = [[0.30, 0.30], [0.74, 0.78]];
  for (const [fx, fy] of faces) {
    const cx = Math.floor(fx * size), cy = Math.floor(fy * size);
    hole(Math.floor(cx - 32 * sc), Math.floor(cy - 4 * sc), 10 * sc, 17 * sc, 0.9);
    hole(Math.floor(cx + 32 * sc), Math.floor(cy + 4 * sc), 10 * sc, 17 * sc, 0.9);
    hole(cx, Math.floor(cy + 62 * sc), 6 * sc, 34 * sc, 0.8);
  }

  // Beberapa lubang kayu kecil
  for (let k = 0; k < 3; k++) {
    const cx = Math.floor(rand() * size), cy = Math.floor(rand() * size);
    const rr = (5 + rand() * 6) * sc;
    hole(cx, cy, rr, rr * 1.6, 0.7);
  }

  // Goresan cakar: 4 garis sejajar + noda merah tua
  const claws = [[0.10, 0.52], [0.52, 0.06], [0.90, 0.30]];
  for (const [fx, fy] of claws) {
    const bx = fx * size, by = fy * size;
    const len = 170 * sc;
    const lean = (rand() - 0.5) * 0.6;
    for (let c = 0; c < 4; c++) {
      const off = (c - 1.5) * 12 * sc;
      for (let t = 0; t <= len; t += 0.6) {
        const px = bx + off + Math.sin(t * 0.025 + c) * 2.2 * sc + t * lean * 0.25;
        const py = by + t;
        const taper = Math.sin((t / len) * Math.PI);
        stampEllipse(size, Math.floor(px), Math.floor(py), 1.6 * sc * (0.4 + taper), 1.8 * sc, (i, d) => {
          if (d < 1) {
            const k = (1 - d) * taper;
            hgt[i] -= k * 0.45;
            scar[i] = Math.max(scar[i], k * 0.8);
          } else if (d < 4.5) {
            stain[i] = Math.max(stain[i], 0.7 * (1 - (d - 1) / 3.5) * taper);
          }
        });
      }
    }
  }

  // Jaga rentang height 0..1
  for (let i = 0; i < N; i++) hgt[i] = clamp(hgt[i], 0, 1.1) / 1.1;

  // --- 3. Warna: kayu mati, lumut, lumut kerak, noda basah ---
  const rgba = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const hv = hgt[i];

      const tint = fbm(u, v, 4, 4, 3, 7);
      const t = smooth(0.12, 0.72, hv);
      let r = lerp(5, 104, t) * (0.78 + tint * 0.44);
      let g = lerp(4, 86, t) * (0.78 + tint * 0.36);
      let b = lerp(3, 72, t) * (0.85 + tint * 0.26);

      // lumut hijau gelap di dataran kulit kayu
      const mm = smooth(0.50, 0.68, fbm(u, v, 3, 3, 4, 11));
      const mossDetail = 0.45 + 0.9 * fbm(u, v, 46, 30, 3, 15);
      const moss = clamp(mm * mossDetail, 0, 1) * smooth(0.30, 0.80, hv) * 0.9;
      const mt = 0.55 + 0.6 * hv;
      r = lerp(r, 30 * mt, moss);
      g = lerp(g, 54 * mt, moss);
      b = lerp(b, 24 * mt, moss);

      // lumut kerak pucat
      const li = smooth(0.76, 0.84, fbm(u, v, 30, 30, 2, 13)) * 0.5 * t;
      r = lerp(r, 134, li);
      g = lerp(g, 140, li);
      b = lerp(b, 116, li);

      // serat kayu halus memanjang di permukaan lempeng
      const grain = 0.74 + 0.5 * fbm(u, v, 110, 7, 3, 95);
      r *= grain; g *= grain; b *= grain;

      // garis basah gelap vertikal
      const st = fbm(u, v, 16, 1, 3, 17);
      const k = 0.52 + 0.48 * st;
      r *= k; g *= k; b *= k * 1.02;

      // goresan & noda merah
      const sc2 = scar[i];
      r = lerp(r, 128, sc2); g = lerp(g, 104, sc2); b = lerp(b, 80, sc2);
      const sn = stain[i] * (1 - sc2);
      r = lerp(r, r * 0.35 + 62, sn * 0.8); g = lerp(g, g * 0.25 + 6, sn * 0.8); b = lerp(b, b * 0.25 + 5, sn * 0.8);

      // lubang/mata hitam
      const dk = 1 - dark[i] * 0.985;
      r *= dk; g *= dk; b *= dk;

      const o = i * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }

  return {
    color: { size, rgba },
    normal: heightToNormal(hgt, size, 5 * (size / 512))
  };
}

export function generateLeafData(size) {
  const sc = size / 512;
  const N = size * size;
  const hgt = new Float32Array(N);
  const shade = new Float32Array(N);
  const rand = rng(9001);

  const put = (x, y, h, s) => {
    const xx = ((Math.round(x) % size) + size) % size;
    const yy = ((Math.round(y) % size) + size) % size;
    const i = yy * size + xx;
    if (h >= hgt[i]) { hgt[i] = h; shade[i] = s; }
  };

  // Jarum pinus menjuntai ke bawah
  const needles = Math.floor(9000 * sc * sc);
  for (let n = 0; n < needles; n++) {
    const x0 = rand() * size, y0 = rand() * size;
    const ang = Math.PI / 2 + (rand() - 0.5) * 1.7;
    const len = (14 + rand() * 24) * sc;
    const h0 = 0.45 + rand() * 0.55;
    const s = rand();
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let t = 0; t < len; t += 0.7) {
      const k = t / len;
      const px = x0 + dx * t + Math.sin(k * 3 + n) * 0.8 * sc;
      const py = y0 + dy * t;
      const h = h0 * (1 - k * 0.5);
      put(px, py, h, s);
      if (sc > 0.75) put(px + 1, py, h * 0.8, s);
    }
  }

  const rgba = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const h = hgt[i];
      const clump = fbm(u, v, 5, 5, 3, 91);
      const depth = h > 0 ? 0.35 + h * 0.65 : 0.12;
      const s = shade[i];
      // hijau-hitam kebiruan, sebagian jarum mati kecoklatan
      let r = lerp(14, 40, s) * depth;
      let g = lerp(28, 66, s) * depth;
      let b = lerp(18, 38, s) * depth;
      if (s > 0.93) { r = 70 * depth; g = 52 * depth; b = 30 * depth; }
      const cm = 0.55 + clump * 0.8;
      r *= cm; g *= cm; b *= cm;
      const o = i * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }

  // sedikit blur pada height agar normal tidak terlalu tajam
  const soft = new Float32Array(N);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          a += hgt[(((y + oy) + size) % size) * size + (((x + ox) + size) % size)];
        }
      }
      soft[y * size + x] = a / 9;
    }
  }

  return {
    color: { size, rgba },
    normal: heightToNormal(soft, size, 6 * sc)
  };
}
