import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = new URL('../models/flashlight.glb', import.meta.url).href;

// ---- Pengaturan model & posisi (silakan diubah) ----
const FLASH_LENGTH = 0.26;                       // panjang senter di layar (meter)
const HAND_Y = -0.17;                            // tinggi senter terhadap kamera
const HAND_Z = -0.40;                            // jarak senter dari kamera
const HAND_X_MAX = 0.19;                         // posisi kanan maksimum
const AIM_POINT = new THREE.Vector3(0, -0.05, -8); // titik bidik (tengah layar)
const ROLL = -1.1;                               // putaran badan senter (rad)

// Sumbu panjang model (hasil analisa): ujung +AXIS = lensa/kaca depan senter
const MODEL_AXIS = new THREE.Vector3(0.92749594, 0.03798203, 0.37189869).normalize();

// Buat tekstur kulit manusia realistis lengkap dengan pori-pori, lipatan buku jari, & urat halus
function createRealisticSkinTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  // Warna dasar kulit manusia natural
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#d29b7e');
  grad.addColorStop(0.5, '#c68b6d');
  grad.addColorStop(1, '#b37759');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subsurface scattering rona kemerahan di area sendi/buku jari
  for (let i = 0; i < 45; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 55;
    const rg = ctx.createRadialGradient(x, y, 2, x, y, r);
    rg.addColorStop(0, 'rgba(175, 72, 58, 0.12)');
    rg.addColorStop(1, 'rgba(175, 72, 58, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Urat nadi halus di punggung tangan
  ctx.strokeStyle = 'rgba(72, 95, 110, 0.11)';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let vx = Math.random() * size;
    let vy = 0;
    ctx.moveTo(vx, vy);
    for (let s = 0; s < 6; s++) {
      vx += (Math.random() - 0.5) * 45;
      vy += size / 6;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  // Bump canvas untuk pori-pori & garis lipatan kulit
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Pori-pori mikro kulit
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 115 + Math.floor(Math.random() * 25);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, y, 1.5, 1.5);

    if (i % 3 === 0) {
      ctx.fillStyle = i % 6 === 0 ? 'rgba(90, 50, 35, 0.06)' : 'rgba(255, 220, 195, 0.05)';
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  // Garis-garis lipatan kulit halus pada ruas jari
  bCtx.strokeStyle = 'rgba(90, 90, 90, 0.45)';
  bCtx.lineWidth = 1.2;
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 8 + Math.random() * 18;
    bCtx.beginPath();
    bCtx.moveTo(x - w / 2, y);
    bCtx.quadraticCurveTo(x, y + (Math.random() - 0.5) * 4, x + w / 2, y);
    bCtx.stroke();
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { colorMap, bumpMap };
}

export class FlashlightSystem {
  constructor(camera, scene, audioEngine) {
    this.camera = camera;
    this.audio = audioEngine;
    this.isOn = true;
    this.litMaterials = [];

    this.holder = new THREE.Group();
    this.camera.add(this.holder);

    // Pivot senter: lensa menghadap lurus ke titik bidik
    this.pivot = new THREE.Group();
    this.holder.add(this.pivot);

    // Placeholder sementara sampai model 3D selesai dimuat
    const bodyGeo = new THREE.CylinderGeometry(0.032, 0.026, FLASH_LENGTH, 16);
    bodyGeo.rotateX(Math.PI / 2);
    this.placeholder = new THREE.Mesh(
      bodyGeo,
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 })
    );
    this.pivot.add(this.placeholder);

    // Buat dan pasang model 3D tangan manusia realistis yang menggenggam senter
    this.handGroup = this.createRealisticHandMesh();
    this.pivot.add(this.handGroup);

    // Cahaya utama: keluar dari kaca senter, searah sumbu senter
    this.lensZ = -(FLASH_LENGTH / 2) - 0.012;
    this.spotLight = new THREE.SpotLight(0xfff6e0, 55, 42, Math.PI / 5.2, 0.55, 1.6);
    this.spotLight.position.set(0, 0, this.lensZ);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.1;
    this.target = new THREE.Object3D();
    this.target.position.set(0, 0, -20);
    this.pivot.add(this.target);
    this.spotLight.target = this.target;
    this.pivot.add(this.spotLight);

    // Cahaya pantulan dekat di depan lensa
    this.closeBounceLight = new THREE.PointLight(0xffeedd, 0.8, 3.5);
    this.closeBounceLight.position.set(0, 0, this.lensZ - 0.25);
    this.pivot.add(this.closeBounceLight);

    // Cahaya isi lemah (jarak pendek) supaya tangan & badan senter terlihat jelas
    this.handFill = new THREE.PointLight(0xffe2c0, 0.85, 0.95, 2);
    this.handFill.position.set(0.06, 0.12, 0.1);
    this.camera.add(this.handFill);

    scene.add(this.camera);
    this.updateLayout();
    this.loadModel();
  }

  // Membangun model 3D anatomi tangan kanan manusia yang mencengkeram gagang silinder senter
  createRealisticHandMesh() {
    const hand = new THREE.Group();
    const { colorMap, bumpMap } = createRealisticSkinTextures();

    const skinMat = new THREE.MeshStandardMaterial({
      map: colorMap,
      bumpMap: bumpMap,
      bumpScale: 0.0018,
      roughness: 0.62,
      metalness: 0.04
    });

    const nailMat = new THREE.MeshStandardMaterial({
      color: 0xe6c3b5,
      roughness: 0.28,
      metalness: 0.08
    });

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x161917,
      bumpMap: bumpMap,
      bumpScale: 0.004,
      roughness: 0.88,
      metalness: 0.05
    });

    // Radius gagang senter tempat jari melingkar
    const R = 0.0195;

    // Helper pembuat jari beruas dengan cengkeraman anatomis mengelilingi sumbu Z senter
    const buildGrippingFinger = (cfg) => {
      const fingerGroup = new THREE.Group();
      fingerGroup.position.set(cfg.knuckleX, cfg.knuckleY, cfg.zPos);

      let parentNode = fingerGroup;
      let currentAngle = cfg.startAngle;

      for (let i = 0; i < 3; i++) {
        const segLen = cfg.lengths[i];
        const rProx = cfg.radii[i];
        const rDist = cfg.radii[i + 1];

        const jointPivot = new THREE.Group();
        if (i === 0) {
          // Buku jari utama (Metacarpophalangeal)
          const knuckleMesh = new THREE.Mesh(
            new THREE.SphereGeometry(rProx * 1.12, 16, 14),
            skinMat
          );
          knuckleMesh.scale.set(1.0, 0.88, 1.05);
          jointPivot.add(knuckleMesh);
        } else {
          jointPivot.position.set(0, cfg.lengths[i - 1], 0);
          const interJoint = new THREE.Mesh(
            new THREE.SphereGeometry(rProx * 1.04, 14, 12),
            skinMat
          );
          jointPivot.add(interJoint);
        }

        // Rotasi cengkeraman melingkari badan senter
        jointPivot.rotation.z = cfg.curlAngles[i];
        if (i === 0 && cfg.spreadAngle) {
          jointPivot.rotation.x = cfg.spreadAngle;
        }

        // Segmen phalanx (tulang ruas jari)
        const phalanxGeo = new THREE.CylinderGeometry(rDist, rProx, segLen, 16, 1, false);
        phalanxGeo.translate(0, segLen / 2, 0);
        // Pipihkan sedikit agar penampang jari elips natural
        phalanxGeo.scale(0.92, 1.0, 1.06);
        const phalanxMesh = new THREE.Mesh(phalanxGeo, skinMat);
        jointPivot.add(phalanxMesh);

        // Bantalan ujung jari & kuku anatomis pada ruas terakhir (distal phalanx)
        if (i === 2) {
          const tipSphere = new THREE.Mesh(
            new THREE.SphereGeometry(rDist * 0.98, 16, 14),
            skinMat
          );
          tipSphere.position.set(0, segLen, 0);
          tipSphere.scale.set(0.92, 1.08, 1.04);
          jointPivot.add(tipSphere);

          // Kuku jari di sisi luar ujung jari
          const nailGeo = new THREE.BoxGeometry(rDist * 0.35, segLen * 0.48, rDist * 1.38);
          const nailMesh = new THREE.Mesh(nailGeo, nailMat);
          nailMesh.position.set(rDist * 0.78, segLen * 0.76, 0);
          nailMesh.rotation.z = 0.14;
          jointPivot.add(nailMesh);
        }

        parentNode.add(jointPivot);
        parentNode = jointPivot;
        currentAngle += cfg.curlAngles[i];
      }

      return fingerGroup;
    };

    // 1. Telapak Tangan (Metacarpus / Palm) memeluk sisi kanan & bawah gagang senter
    const palmGroup = new THREE.Group();
    const palmCoreGeo = new THREE.SphereGeometry(1, 24, 20);
    const palmCore = new THREE.Mesh(palmCoreGeo, skinMat);
    palmCore.scale.set(0.015, 0.032, 0.048);
    palmCore.position.set(R + 0.008, -0.004, 0.010);
    palmCore.rotation.z = 0.22;
    palmCore.rotation.y = -0.08;
    palmGroup.add(palmCore);

    // Bantalan otot jempol (Thenar eminence)
    const thenar = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 16), skinMat);
    thenar.scale.set(0.016, 0.022, 0.028);
    thenar.position.set(0.012, 0.015, 0.018);
    thenar.rotation.set(0.25, 0.3, -0.45);
    palmGroup.add(thenar);

    // Bantalan sisi bawah telapak (Hypothenar eminence)
    const hypothenar = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 16), skinMat);
    hypothenar.scale.set(0.014, 0.020, 0.032);
    hypothenar.position.set(R + 0.005, -0.019, 0.024);
    hypothenar.rotation.z = 0.45;
    palmGroup.add(hypothenar);

    hand.add(palmGroup);

    // 2. Empat Jari (Telunjuk, Tengah, Manis, Kelingking) melingkari silinder senter dengan rapat
    // Posisi sumbu Z negatif = ke arah kepala senter, positif = ke arah belakang
    const fingerSpecs = [
      {
        // Jari Telunjuk (Index) - paling depan
        zPos: -0.026,
        knuckleX: R + 0.004,
        knuckleY: 0.017,
        lengths: [0.028, 0.022, 0.017],
        radii: [0.0084, 0.0074, 0.0065, 0.0056],
        curlAngles: [1.22, 1.15, 0.95],
        spreadAngle: 0.06
      },
      {
        // Jari Tengah (Middle) - terpanjang, mencengkeram kuat di tengah
        zPos: -0.007,
        knuckleX: R + 0.006,
        knuckleY: 0.015,
        lengths: [0.031, 0.024, 0.018],
        radii: [0.0088, 0.0078, 0.0067, 0.0058],
        curlAngles: [1.26, 1.18, 0.98],
        spreadAngle: 0.02
      },
      {
        // Jari Manis (Ring)
        zPos: 0.012,
        knuckleX: R + 0.005,
        knuckleY: 0.011,
        lengths: [0.028, 0.021, 0.017],
        radii: [0.0082, 0.0072, 0.0063, 0.0054],
        curlAngles: [1.30, 1.20, 0.98],
        spreadAngle: -0.03
      },
      {
        // Jari Kelingking (Pinky) - paling belakang
        zPos: 0.029,
        knuckleX: R + 0.002,
        knuckleY: 0.005,
        lengths: [0.023, 0.017, 0.015],
        radii: [0.0074, 0.0064, 0.0056, 0.0048],
        curlAngles: [1.36, 1.24, 1.02],
        spreadAngle: -0.08
      }
    ];

    for (const spec of fingerSpecs) {
      hand.add(buildGrippingFinger(spec));
    }

    // 3. Ibu Jari (Thumb) menekan bagian atas/samping kiri badan senter (posisi tombol/grip)
    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(0.010, 0.018, 0.014);
    // Arahkan jempol menyilang ke depan-kiri atas silinder senter
    thumbRoot.rotation.set(-1.12, 0.38, 0.58);

    const thumbLengths = [0.025, 0.021];
    const thumbRadii = [0.0096, 0.0084, 0.0074];
    const thumbCurls = [-0.42, -0.52];

    let thumbParent = thumbRoot;
    for (let i = 0; i < 2; i++) {
      const segLen = thumbLengths[i];
      const rP = thumbRadii[i];
      const rD = thumbRadii[i + 1];

      const jPivot = new THREE.Group();
      if (i > 0) jPivot.position.set(0, thumbLengths[i - 1], 0);

      const jSphere = new THREE.Mesh(new THREE.SphereGeometry(rP * 1.05, 14, 12), skinMat);
      jPivot.add(jSphere);
      jPivot.rotation.x = thumbCurls[i];

      const segGeo = new THREE.CylinderGeometry(rD, rP, segLen, 16);
      segGeo.translate(0, segLen / 2, 0);
      segGeo.scale(1.06, 1.0, 0.90);
      jPivot.add(new THREE.Mesh(segGeo, skinMat));

      if (i === 1) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(rD * 1.0, 16, 14), skinMat);
        tip.position.set(0, segLen, 0);
        tip.scale.set(1.06, 1.1, 0.90);
        jPivot.add(tip);

        const thumbNail = new THREE.Mesh(
          new THREE.BoxGeometry(rD * 1.4, segLen * 0.52, rD * 0.35),
          nailMat
        );
        thumbNail.position.set(0, segLen * 0.74, rD * 0.78);
        thumbNail.rotation.x = -0.15;
        jPivot.add(thumbNail);
      }

      thumbParent.add(jPivot);
      thumbParent = jPivot;
    }
    hand.add(thumbRoot);

    // 4. Pergelangan Tangan (Wrist) & Lengan Bawah (Forearm Sleeve) mengarah ke kamera kanan bawah
    const wristGroup = new THREE.Group();
    wristGroup.position.set(0.015, -0.012, 0.052);
    wristGroup.rotation.set(0.28, -0.18, 0.15);

    const wristGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.055, 20);
    wristGeo.scale(0.88, 1.0, 1.12);
    wristGeo.rotateX(Math.PI / 2);
    const wristMesh = new THREE.Mesh(wristGeo, skinMat);
    wristGroup.add(wristMesh);

    // Manset lengan jaket gelap di belakang pergelangan tangan
    const cuffGeo = new THREE.CylinderGeometry(0.038, 0.032, 0.16, 20);
    cuffGeo.scale(0.92, 1.0, 1.12);
    cuffGeo.rotateX(Math.PI / 2);
    const cuffMesh = new THREE.Mesh(cuffGeo, sleeveMat);
    cuffMesh.position.set(0.004, -0.006, 0.095);
    wristGroup.add(cuffMesh);

    hand.add(wristGroup);

    // Pastikan seluruh bagian tangan tidak terpotong frustum kamera dekat
    hand.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });

    return hand;
  }

  // Atur posisi senter sesuai rasio layar (agar tidak keluar layar di HP portrait)
  updateLayout() {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const halfW = Math.abs(HAND_Z) * Math.tan(fov / 2) * this.camera.aspect;
    const x = Math.min(HAND_X_MAX, halfW * 0.62);
    this.pivot.position.set(x, HAND_Y, HAND_Z);
    const dir = AIM_POINT.clone().sub(this.pivot.position).normalize();
    this.pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  }

  loadModel() {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;

        // 1) Putar model: sumbu lensa -> -Z (depan), lalu roll
        const aligner = new THREE.Group();
        aligner.add(model);
        const qAlign = new THREE.Quaternion().setFromUnitVectors(
          MODEL_AXIS, new THREE.Vector3(0, 0, -1)
        );
        const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ROLL);
        aligner.quaternion.copy(qRoll.multiply(qAlign));
        aligner.updateMatrixWorld(true);

        // 2) Pusatkan & skalakan
        const box = new THREE.Box3().setFromObject(aligner, true);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        aligner.position.copy(center).negate();

        const wrapper = new THREE.Group();
        wrapper.add(aligner);
        const s = FLASH_LENGTH / size.z;
        wrapper.scale.setScalar(s);

        // 3) Material: opaque, tidak membuang bayangan, glow hanya saat ON
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = false;
          o.receiveShadow = false;
          o.frustumCulled = false;
          const m = o.material;
          m.transparent = false;
          m.depthWrite = true;
          m.metalness = Math.min(m.metalness ?? 1, 0.45);
          if (m.emissiveMap) this.litMaterials.push(m);
        });
        this.setGlow(this.isOn);

        this.pivot.remove(this.placeholder);
        this.placeholder.geometry.dispose();
        this.placeholder.material.dispose();
        this.pivot.add(wrapper);

        // 4) Cahaya tepat di permukaan kaca depan
        this.lensZ = -(size.z * s) / 2 - 0.012;
        this.spotLight.position.set(0, 0, this.lensZ);
        this.closeBounceLight.position.set(0, 0, this.lensZ - 0.25);
      },
      undefined,
      (err) => console.error('Gagal memuat models/flashlight.glb', err)
    );
  }

  setGlow(on) {
    for (const m of this.litMaterials) m.emissiveIntensity = on ? 1.0 : 0.05;
  }

  toggle() {
    this.isOn = !this.isOn;

    this.spotLight.visible = this.isOn;
    this.spotLight.intensity = this.isOn ? 55 : 0;
    this.closeBounceLight.visible = this.isOn;
    this.closeBounceLight.intensity = this.isOn ? 0.8 : 0;
    this.setGlow(this.isOn);

    this.audio.playFlashlightClick(this.isOn);

    const stateEl = document.getElementById('light-state');
    const btnEl = document.getElementById('btn-flashlight');
    if (this.isOn) {
      stateEl.textContent = 'ON';
      stateEl.className = 'state-on';
      btnEl.classList.add('active');
    } else {
      stateEl.textContent = 'OFF';
      stateEl.className = 'state-off';
      btnEl.classList.remove('active');
    }
  }
}
