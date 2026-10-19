import * as THREE from 'three';

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

  // 2. Tekstur Kulit Kayu Pohon (Bark HD)
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = 256;
  barkCanvas.height = 512;
  const bCtx = barkCanvas.getContext('2d');

  bCtx.fillStyle = '#1b1612';
  bCtx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const w = 1 + Math.random() * 3;
    const h = 12 + Math.random() * 32;
    const v = Math.floor(Math.random() * 22);
    bCtx.fillStyle = `rgb(${22 + v}, ${18 + v}, ${14 + v})`;
    bCtx.fillRect(x, y, w, h);
  }

  const barkTex = new THREE.CanvasTexture(barkCanvas);
  barkTex.wrapS = THREE.RepeatWrapping;
  barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(2, 4);

  return {
    groundTex,
    barkTex
  };
}
