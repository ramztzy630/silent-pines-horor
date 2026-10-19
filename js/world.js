import * as THREE from 'three';
import { createForestTextures } from './textures.js';

export class HorrorWorld {
  constructor(scene) {
    this.scene = scene;
    this.treeColliders = [];
    this.stalker = null;

    this.initEnvironment();
  }

  initEnvironment() {
    const { groundTex, barkTex } = createForestTextures();

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

    // Material Pohon Pinus
    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      bumpMap: barkTex,
      bumpScale: 0.25,
      roughness: 0.9
    });
    const leavesMat = new THREE.MeshStandardMaterial({
      color: 0x08140b,
      roughness: 0.9
    });

    // Generate 160 Pohon Pinus Raksasa
    for (let i = 0; i < 160; i++) {
      const x = (Math.random() - 0.5) * 130;
      const z = (Math.random() - 0.5) * 130;

      // Jangan taruh pohon tepat di titik spawn pemain
      if (Math.hypot(x, z) < 5.5) continue;

      const treeGroup = new THREE.Group();
      const height = 9 + Math.random() * 7;
      const radius = 0.35 + Math.random() * 0.25;

      const trunkGeo = new THREE.CylinderGeometry(radius * 0.65, radius, height, 10);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Daun Pinus Berlapis
      const coneGeo = new THREE.ConeGeometry(radius * 5.2, 5.5, 9);
      const cone1 = new THREE.Mesh(coneGeo, leavesMat);
      cone1.position.y = height - 1.5;
      treeGroup.add(cone1);

      const cone2 = new THREE.Mesh(coneGeo, leavesMat);
      cone2.position.y = height + 1.2;
      cone2.scale.set(0.75, 0.75, 0.75);
      treeGroup.add(cone2);

      treeGroup.position.set(x, 0, z);
      this.scene.add(treeGroup);

      this.treeColliders.push({ x, z, radius: radius + 0.35 });
    }

    // Entitas Bayangan Bermata Menyala (Stalker)
    this.createStalkerEntity();
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
