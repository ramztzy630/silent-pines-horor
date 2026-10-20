// Generator tekstur pohon & tanah prosedural HD (color, normal, roughness/bump) - seamless / tileable.

function hash2(a, b, seed) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

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

// Sobel 3x3 filter untuk Normal Map tajam & akurat
function heightToNormal(hgt, size, strength) {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = hgt[idx(x - 1, y - 1)], tc = hgt[idx(x, y - 1)], tr = hgt[idx(x + 1, y - 1)];
      const ml = hgt[idx(x - 1, y)],                             mr = hgt[idx(x + 1, y)];
      const bl = hgt[idx(x - 1, y + 1)], bc = hgt[idx(x, y + 1)], br = hgt[idx(x + 1, y + 1)];

      const nx = ((tl + 2 * ml + bl) - (tr + 2 * mr + br)) * 0.25 * strength;
      const ny = ((tl + 2 * tc + tr) - (bl + 2 * bc + br)) * 0.25 * strength;
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
  const dark = new Float32Array(N);
  const scar = new Float32Array(N);
  const stain = new Float32Array(N);

  // 1. Height: alur kulit kayu pinus tua yang sangat dalam, kasar, dan berlapis
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbm(u, v, 3, 2, 3, 5);
      const uu = (u + (warp - 0.5) * 0.16 + 1) % 1;
      const r = fbm(uu, v, 14, 3, 5, 21);
      const crease = 1 - Math.abs(2 * r - 1);

      let hv = 1 - smooth(0.82, 0.985, crease) * 1.15 - smooth(0.50, 0.82, crease) * 0.36;

      // Patahan horizontal kulit kayu
      const r2 = fbm(uu, v, 10, 38, 4, 43);
      const c2 = 1 - Math.abs(2 * r2 - 1);
      hv -= smooth(0.88, 0.99, c2) * 0.48;

      // Variasi tinggi lempeng & mikro-tekstur serat tajam
      hv += 0.22 * (fbm(u, v, 26, 6, 3, 29) - 0.5);
      hv += 0.30 * (fbm(u, v, 96, 20, 3, 61) - 0.5);
      hv += 0.15 * (fbm(u, v, 240, 48, 2, 83) - 0.5);
      hgt[y * size + x] = hv;
    }
  }

  {
    let mn0 = 1e9, mx0 = -1e9;
    for (let i = 0; i < N; i++) {
      if (hgt[i] < mn0) mn0 = hgt[i];
      if (hgt[i] > mx0) mx0 = hgt[i];
    }
    const rg = mx0 - mn0 || 1;
    for (let i = 0; i < N; i++) hgt[i] = (hgt[i] - mn0) / rg;
  }

  // 2. Fitur horor: cekungan mata organik & bekas cakaran dalam
  const rand = rng(1337);
  const hole = (cx, cy, rx, ry, depth) => {
    stampEllipse(size, cx, cy, rx, ry, (i, d) => {
      const jag = 1 + 0.20 * Math.sin(i * 0.37) * Math.sin(i * 0.011);
      const dd = d * jag;
      if (dd < 1) {
        const k = 1 - dd;
        hgt[i] -= k * depth;
        dark[i] = Math.max(dark[i], smooth(0, 0.25, k));
      } else if (dd < 2.3) {
        hgt[i] += 0.25 * (1 - (dd - 1) / 1.3);
        dark[i] = Math.max(dark[i], 0.42 * (1 - (dd - 1) / 1.3));
      }
    });
  };

  const faces = [[0.30, 0.30], [0.74, 0.78]];
  for (const [fx, fy] of faces) {
    const cx = Math.floor(fx * size), cy = Math.floor(fy * size);
    hole(Math.floor(cx - 32 * sc), Math.floor(cy - 4 * sc), 10 * sc, 17 * sc, 0.95);
    hole(Math.floor(cx + 32 * sc), Math.floor(cy + 4 * sc), 10 * sc, 17 * sc, 0.95);
    hole(cx, Math.floor(cy + 62 * sc), 7 * sc, 36 * sc, 0.88);
  }

  for (let k = 0; k < 4; k++) {
    const cx = Math.floor(rand() * size), cy = Math.floor(rand() * size);
    const rr = (5 + rand() * 7) * sc;
    hole(cx, cy, rr, rr * 1.65, 0.75);
  }

  const claws = [[0.10, 0.52], [0.52, 0.06], [0.90, 0.30]];
  for (const [fx, fy] of claws) {
    const bx = fx * size, by = fy * size;
    const len = 175 * sc;
    const lean = (rand() - 0.5) * 0.6;
    for (let c = 0; c < 4; c++) {
      const off = (c - 1.5) * 12 * sc;
      for (let t = 0; t <= len; t += 0.6) {
        const px = bx + off + Math.sin(t * 0.025 + c) * 2.2 * sc + t * lean * 0.25;
        const py = by + t;
        const taper = Math.sin((t / len) * Math.PI);
        stampEllipse(size, Math.floor(px), Math.floor(py), 1.7 * sc * (0.4 + taper), 1.9 * sc, (i, d) => {
          if (d < 1) {
            const k = (1 - d) * taper;
            hgt[i] -= k * 0.52;
            scar[i] = Math.max(scar[i], k * 0.85);
          } else if (d < 4.5) {
            stain[i] = Math.max(stain[i], 0.78 * (1 - (d - 1) / 3.5) * taper);
          }
        });
      }
    }
  }

  for (let i = 0; i < N; i++) hgt[i] = clamp(hgt[i], 0, 1.1) / 1.1;

  // 3. Color & Roughness/Bump Map
  const rgba = new Uint8ClampedArray(N * 4);
  const bumpRgba = new Uint8ClampedArray(N * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const hv = hgt[i];

      const tint = fbm(u, v, 4, 4, 3, 7);
      // Kontras ambient occlusion lebih pekat di sela-sela kulit kayu
      const t = smooth(0.14, 0.74, hv);
      const ao = smooth(0.02, 0.35, hv);
      let r = lerp(3, 96, t) * (0.74 + tint * 0.44) * (0.35 + 0.65 * ao);
      let g = lerp(3, 78, t) * (0.74 + tint * 0.36) * (0.35 + 0.65 * ao);
      let b = lerp(2, 65, t) * (0.80 + tint * 0.26) * (0.35 + 0.65 * ao);

      // Lumut lembap gelap
      const mm = smooth(0.50, 0.68, fbm(u, v, 3, 3, 4, 11));
      const mossDetail = 0.45 + 0.9 * fbm(u, v, 46, 30, 3, 15);
      const moss = clamp(mm * mossDetail, 0, 1) * smooth(0.30, 0.80, hv) * 0.88;
      const mt = 0.50 + 0.55 * hv;
      r = lerp(r, 24 * mt, moss);
      g = lerp(g, 46 * mt, moss);
      b = lerp(b, 20 * mt, moss);

      // Jamur kerak pucat mati
      const li = smooth(0.76, 0.84, fbm(u, v, 30, 30, 2, 13)) * 0.48 * t;
      r = lerp(r, 125, li);
      g = lerp(g, 132, li);
      b = lerp(b, 108, li);

      // Serat mikro vertikal tajam
      const grain = 0.70 + 0.56 * fbm(u, v, 128, 8, 3, 95);
      r *= grain; g *= grain; b *= grain;

      // Rembesan air gelap vertikal
      const st = fbm(u, v, 16, 1, 3, 17);
      const k = 0.48 + 0.52 * st;
      r *= k; g *= k; b *= k * 1.02;

      // Goresan cakar & noda darah mengering
      const sc2 = scar[i];
      r = lerp(r, 122, sc2); g = lerp(g, 96, sc2); b = lerp(b, 72, sc2);
      const sn = stain[i] * (1 - sc2);
      r = lerp(r, r * 0.30 + 68, sn * 0.85);
      g = lerp(g, g * 0.20 + 5, sn * 0.85);
      b = lerp(b, b * 0.20 + 4, sn * 0.85);

      const dk = 1 - dark[i] * 0.99;
      r *= dk; g *= dk; b *= dk;

      const o = i * 4;
      rgba[o] = clamp(r, 0, 255);
      rgba[o + 1] = clamp(g, 0, 255);
      rgba[o + 2] = clamp(b, 0, 255);
      rgba[o + 3] = 255;

      const bv = clamp(Math.floor(hv * 255), 0, 255);
      bumpRgba[o] = bv;
      bumpRgba[o + 1] = bv;
      bumpRgba[o + 2] = bv;
      bumpRgba[o + 3] = 255;
    }
  }

  return {
    color: { size, rgba },
    normal: heightToNormal(hgt, size, 8.5 * (size / 512)),
    bump: { size, rgba: bumpRgba }
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

  const needles = Math.floor(11000 * sc * sc);
  for (let n = 0; n < needles; n++) {
    const x0 = rand() * size, y0 = rand() * size;
    const ang = Math.PI / 2 + (rand() - 0.5) * 1.7;
    const len = (14 + rand() * 26) * sc;
    const h0 = 0.45 + rand() * 0.55;
    const s = rand();
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let t = 0; t < len; t += 0.65) {
      const k = t / len;
      const px = x0 + dx * t + Math.sin(k * 3 + n) * 0.8 * sc;
      const py = y0 + dy * t;
      const h = h0 * (1 - k * 0.5);
      put(px, py, h, s);
      if (sc > 0.75) put(px + 1, py, h * 0.82, s);
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
      const depth = h > 0 ? 0.30 + h * 0.70 : 0.08;
      const s = shade[i];
      let r = lerp(10, 32, s) * depth;
      let g = lerp(20, 52, s) * depth;
      let b = lerp(14, 30, s) * depth;
      if (s > 0.90) { r = 62 * depth; g = 44 * depth; b = 24 * depth; }
      const cm = 0.50 + clump * 0.82;
      r *= cm; g *= cm; b *= cm;
      const o = i * 4;
      rgba[o] = clamp(r, 0, 255);
      rgba[o + 1] = clamp(g, 0, 255);
      rgba[o + 2] = clamp(b, 0, 255);
      rgba[o + 3] = 255;
    }
  }

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
    normal: heightToNormal(soft, size, 7.5 * sc)
  };
}
