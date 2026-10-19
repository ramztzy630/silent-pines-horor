import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createForestTextures } from './textures.js';

export class HorrorWorld {
  constructor(scene) {
    this.scene = scene;
    this.treeColliders = [];
    this.stalker = null;

    this.initEnvironment();
  }

  initEnvironment() {
    const { groundTex, barkTex, barkNormal, leafTex, leafNormal } = createForestTextures();

    // Kabut tebal gelap
    this.scene.fog = new THREE.FogExp2(0x030503, 0.075);

    // Cahaya bulan sangat redup agar saat senter mati suasana tetap mencekam
    const ambient = new THREE.AmbientLight(0x0b1014, 0.12);
    this.scene.add(ambient);

    // Lantai Hutan
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      bumpMap: groundTex,
      bumpScale: 0.15,
      roughness: 0.95
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Material Pohon (color map + normal map HD)
    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.93,
      metalness: 0.0
    });
    const leavesMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      normalMap: leafNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.95
    });

    // Geometri daun dasar (menjuntai & bergerigi), dipakai ulang oleh semua pohon
    const coneBase = this.makeDroopyCone(2.7, 5.2);
    const UP = new THREE.Vector3(0, 1, 0);
    const tmpM = new THREE.Matrix4();
    const place = (geo, pos, quat, scl) => {
      const g = geo.clone();
      g.applyMatrix4(tmpM.compose(pos, quat, scl));
      return g;
    };

    // Generate 160 Pohon: pinus hidup + pohon mati kering
    for (let i = 0; i < 160; i++) {
      const x = (Math.random() - 0.5) * 130;
      const z = (Math.random() - 0.5) * 130;

      // Jangan taruh pohon tepat di titik spawn pemain
      if (Math.hypot(x, z) < 5.5) continue;

      const isDead = Math.random() < 0.22;
      const height = 9 + Math.random() * 7;
      const radius = 0.35 + Math.random() * 0.25;
      const topR = radius * (isDead ? 0.45 : 0.62);

      // --- Batang: bengkok, tidak sempurna ---
      const trunkGeo = new THREE.CylinderGeometry(topR, radius, height, 14, 12);
      trunkGeo.translate(0, height / 2, 0);
      const tp = trunkGeo.attributes.position;
      const phase = Math.random() * 6.28;
      const bend = 0.25 + Math.random() * 0.5;
      for (let k = 0; k < tp.count; k++) {
        const px = tp.getX(k), py = tp.getY(k), pz = tp.getZ(k);
        const t = py / height;
        const ang = Math.atan2(pz, px);
        const lump = 1 + 0.07 * Math.sin(ang * 5 + py * 0.9 + phase) + 0.04 * Math.sin(ang * 3 + py * 2.1);
        tp.setXYZ(
          k,
          px * lump + Math.sin(py * 0.45 + phase) * bend * t * t,
          py,
          pz * lump + Math.cos(py * 0.38 + phase) * bend * t * t
        );
      }
      trunkGeo.computeVertexNormals();

      const parts = [trunkGeo];

      // Akar menonjol di pangkal
      const flare = new THREE.CylinderGeometry(radius * 1.0, radius * 1.7, 0.9, 14, 1);
      flare.translate(0, 0.35, 0);
      parts.push(flare);

      const radiusAt = (y) => THREE.MathUtils.lerp(radius, topR, y / height);

      // --- Ranting patah mencuat ---
      const branchCount = isDead ? 9 + Math.floor(Math.random() * 6) : 3 + Math.floor(Math.random() * 4);
      for (let b = 0; b < branchCount; b++) {
        const y = height * (isDead ? 0.22 + Math.random() * 0.72 : 0.18 + Math.random() * 0.4);
        const a = Math.random() * Math.PI * 2;
        const phi = THREE.MathUtils.degToRad(62 + Math.random() * 55);
        const len = (isDead ? 1.6 : 1.1) + Math.random() * 2.4;
        const br = 0.05 + Math.random() * 0.05;
        const dir = new THREE.Vector3(Math.cos(a) * Math.sin(phi), Math.cos(phi), Math.sin(a) * Math.sin(phi));
        const rr = radiusAt(y) * 0.9;
        const base = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
        const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);

        const bg = new THREE.CylinderGeometry(0.012, br, len, 6, 1);
        bg.translate(0, len / 2, 0);
        parts.push(place(bg, base, q, new THREE.Vector3(1, 1, 1)));

        // Ranting kecil bercabang
        const dir2 = dir.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.4
        )).normalize();
        const base2 = base.clone().addScaledVector(dir, len * (0.45 + Math.random() * 0.25));
        const q2 = new THREE.Quaternion().setFromUnitVectors(UP, dir2);
        const len2 = len * (0.4 + Math.random() * 0.3);
        const tg = new THREE.CylinderGeometry(0.008, br * 0.55, len2, 5, 1);
        tg.translate(0, len2 / 2, 0);
        parts.push(place(tg, base2, q2, new THREE.Vector3(1, 1, 1)));
      }

      const trunkMesh = new THREE.Mesh(mergeGeometries(parts), trunkMat);
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;
      parts.forEach((g) => g.dispose());

      const treeGroup = new THREE.Group();
      treeGroup.add(trunkMesh);

      // --- Daun pinus berlapis (pohon hidup saja; pohon mati gundul) ---
      if (!isDead) {
        const layers = [
          { y: height - 4.2, s: 1.3 },
          { y: height - 2.0, s: 1.05 },
          { y: height + 0.2, s: 0.8 },
          { y: height + 2.1, s: 0.5 }
        ];
        const foliage = [];
        for (const L of layers) {
          const q = new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 6.28);
          const sj = L.s * (0.92 + Math.random() * 0.16);
          const ox = Math.sin((L.y / height) * 3.0 + phase) * bend * Math.pow(Math.min(L.y / height, 1), 2);
          const oz = Math.cos((L.y / height) * 2.6 + phase) * bend * Math.pow(Math.min(L.y / height, 1), 2);
          foliage.push(place(coneBase, new THREE.Vector3(ox, L.y, oz), q, new THREE.Vector3(sj, sj, sj)));
        }
        const leafMesh = new THREE.Mesh(mergeGeometries(foliage), leavesMat);
        foliage.forEach((g) => g.dispose());
        treeGroup.add(leafMesh);
      } else {
        // pohon mati sedikit miring
        treeGroup.rotation.z = (Math.random() - 0.5) * 0.14;
        treeGroup.rotation.x = (Math.random() - 0.5) * 0.14;
      }

      treeGroup.position.set(x, 0, z);
      this.scene.add(treeGroup);

      this.treeColliders.push({ x, z, radius: radius + 0.35 });
    }

    // Entitas Bayangan Bermata Menyala (Stalker)
    this.createStalkerEntity();
  }

  // Kerucut daun dengan tepi bergerigi & ujung menjuntai
  makeDroopyCone(R, H) {
    const geo = new THREE.ConeGeometry(R, H, 14, 5);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(z, x);
      const t = r / R; // 0 di ujung, 1 di tepi bawah
      const jag = 1 + (0.10 * Math.sin(a * 7) + 0.06 * Math.sin(a * 13 + 1.3)) * t;
      const droop = -0.55 * t * t * t;
      p.setXYZ(i, x * jag, y + droop, z * jag);
    }
    geo.computeVertexNormals();
    return geo;
  }

  createStalkerEntity() {
    this.stalker = new THREE.Group();

    const bodyGeo = new THREE.CapsuleGeometry(0.32, 1.65, 6, 12);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x020202 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.15;
    this.stalker.add(body);

    // Dua mata putih pucat menyala
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffddaa });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.09, 1.85, 0.28);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.09, 1.85, 0.28);

    this.stalker.add(leftEye, rightEye);
    this.stalker.position.set(14, 0, -18);
    this.scene.add(this.stalker);
  }

  update(playerPos, isFlashlightOn) {
    if (!this.stalker) return;

    // Entitas selalu menatap ke arah pemain
    this.stalker.lookAt(playerPos.x, 0, playerPos.z);

    // Jika pemain terlalu dekat & senter menyala, entitas berpindah tempat di balik kabut
    const dist = Math.hypot(
      playerPos.x - this.stalker.position.x,
      playerPos.z - this.stalker.position.z
    );

    if (dist < 7.5 && isFlashlightOn) {
      const angle = Math.random() * Math.PI * 2;
      const newDist = 18 + Math.random() * 14;
      this.stalker.position.set(
        playerPos.x + Math.cos(angle) * newDist,
        0,
        playerPos.z + Math.sin(angle) * newDist
      );
    }
  }
}
