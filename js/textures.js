import * as THREE from 'three';
import { generateBarkData, generateLeafData } from './treegen.js';

export function createForestTextures() {
  // 1. Tekstur Lantai Hutan (Tanah, Lumut, Ranting)
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 512;
  groundCanvas.height = 512;
  const gCtx = groundCanvas.getContext('2d');

  gCtx.fillStyle = '#121610';
  gCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = Math.floor(Math.random() * 28);
    gCtx.fillStyle = `rgb(${14 + shade}, ${18 + shade}, ${12 + shade})`;
    gCtx.fillRect(x, y, 2, 2);
  }

  // Ranting kering acak
  gCtx.strokeStyle = '#2b2318';
  gCtx.lineWidth = 1.5;
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const angle = Math.random() * Math.PI * 2;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14);
    gCtx.stroke();
  }

  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(45, 45);

  // 2. Tekstur Pohon (kulit kayu + daun pinus): color map + normal map, tileable
  const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  // Desktop 1024px, HP 768px (lebih cepat dibuat), HP RAM kecil 512px
  const BARK_RES = lowMem ? 512 : isMobile ? 768 : 1024;
  const LEAF_RES = lowMem ? 256 : 512;

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
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const barkTex = makeTex(bark.color, true, 2, 3);
  const barkNormal = makeTex(bark.normal, false, 2, 3);
  const leafTex = makeTex(leaf.color, true, 8, 3);
  const leafNormal = makeTex(leaf.normal, false, 8, 3);

  return {
    groundTex,
    barkTex,
    barkNormal,
    leafTex,
    leafNormal
  };
}
