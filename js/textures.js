import * as THREE from 'three';
import { generateBarkData, generateLeafData } from './treegen.js';

export function createForestTextures() {
  // 1. Tekstur Lantai Hutan HD (Tanah basah gelap, akar busuk, batu, ranting kering, & normal map)
  const gSize = 512;
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = gSize;
  groundCanvas.height = gSize;
  const gCtx = groundCanvas.getContext('2d');

  gCtx.fillStyle = '#0c0f0a';
  gCtx.fillRect(0, 0, gSize, gSize);

  // Variasi bercak lumpur gelap & lumut hutan mati
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * gSize;
    const y = Math.random() * gSize;
    const r = 18 + Math.random() * 55;
    const grd = gCtx.createRadialGradient(x, y, 2, x, y, r);
    const darkPatch = Math.random() > 0.45;
    grd.addColorStop(0, darkPatch ? 'rgba(5, 7, 5, 0.55)' : 'rgba(24, 30, 18, 0.35)');
    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    gCtx.fillStyle = grd;
    gCtx.beginPath();
    gCtx.arc(x, y, r, 0, Math.PI * 2);
    gCtx.fill();
  }

  // Detail butiran tanah & daun pinus gugur
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * gSize;
    const y = Math.random() * gSize;
    const shade = Math.floor(Math.random() * 26);
    gCtx.fillStyle = `rgb(${10 + shade}, ${13 + shade}, ${9 + shade})`;
    gCtx.fillRect(x, y, 2, 2);
  }

  // Ranting patah & jarum pinus kering
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * gSize;
    const y = Math.random() * gSize;
    const angle = Math.random() * Math.PI * 2;
    const len = 8 + Math.random() * 16;
    gCtx.strokeStyle = Math.random() > 0.3 ? '#251d14' : '#3a2e21';
    gCtx.lineWidth = 1 + Math.random() * 1.4;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    gCtx.stroke();
  }

  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(50, 50);
  groundTex.anisotropy = 8;
  groundTex.colorSpace = THREE.SRGBColorSpace;

  const groundBump = new THREE.CanvasTexture(groundCanvas);
  groundBump.wrapS = THREE.RepeatWrapping;
  groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(50, 50);
  groundBump.anisotropy = 8;

  // 2. Tekstur Pohon HD (kulit kayu + daun pinus): color map + normal map + bump map
  const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const BARK_RES = lowMem ? 512 : isMobile ? 1024 : 1024;
  const LEAF_RES = lowMem ? 512 : 512;

  const bark = generateBarkData(BARK_RES);
  const leaf = generateLeafData(LEAF_RES);

  const makeTex = (img, srgb, repX, repY) => {
    const c = document.createElement('canvas');
    c.width = img.size;
    c.height = img.size;
    c.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(img.rgba.buffer), img.size, img.size), 0, 0
    );
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    t.anisotropy = 16;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const barkTex = makeTex(bark.color, true, 2, 3.5);
  const barkNormal = makeTex(bark.normal, false, 2, 3.5);
  const barkBump = makeTex(bark.bump, false, 2, 3.5);
  const leafTex = makeTex(leaf.color, true, 8, 3);
  const leafNormal = makeTex(leaf.normal, false, 8, 3);

  return {
    groundTex,
    groundBump,
    barkTex,
    barkNormal,
    barkBump,
    leafTex,
    leafNormal
  };
}
