import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createForestTextures } from './textures.js';

export class HorrorWorld {
  constructor(scene) {
    this.scene = scene;
    this.treeColliders = [];
    this.stalker = null;
    this.secondaryStalkers = [];
    this.mistParticles = null;
    this.moonLight = null;
    this.lightningFlash = 0;

    this.initEnvironment();
  }

  initEnvironment() {
    const {
      groundTex,
      groundBump,
      barkTex,
      barkNormal,
      barkBump,
      leafTex,
      leafNormal
    } = createForestTextures();

    // Latar belakang & Kabut malam hutan pekat mencekam
    this.scene.background = new THREE.Color(0x020302);
    this.scene.fog = new THREE.FogExp2(0x020403, 0.088);

    // Cahaya langit malam ekstrem redup agar bayangan senter & siluet pohon sangat kontras
    const hemiLight = new THREE.HemisphereLight(0x16222f, 0x040504, 0.14);
    this.scene.add(hemiLight);

    // Cahaya Bulan Pucat (DirectionalLight) dengan Shadow Map lembut dari sela kanopi hutan
    this.moonLight = new THREE.DirectionalLight(0x4a6680, 0.28);
    this.moonLight.position.set(28, 55, -32);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(2048, 2048);
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 140;
    const d = 55;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    this.scene.add(this.moonLight);

    // Lantai Hutan bertekstur tajam & berelief
    const groundGeo = new THREE.PlaneGeometry(170, 170, 96, 96);
    const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const gx = gp.getX(i), gy = gp.getY(i);
      const distFromSpawn = Math.hypot(gx, gy);
      const mound = distFromSpawn < 5 ? 0 : (Math.sin(gx * 0.14) * Math.cos(gy * 0.14) * 0.22 + Math.sin(gx * 0.45 + gy * 0.35) * 0.08);
      gp.setZ(i, mound);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      bumpMap: groundBump,
      bumpScale: 0.24,
      roughness: 0.94,
      metalness: 0.02
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Material Pohon HD (Color + Normal Map kuat + Bump Map)
    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(2.4, 2.4),
      bumpMap: barkBump,
      bumpScale: 0.08,
      roughness: 0.92,
      metalness: 0.02
    });

    const leavesMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      normalMap: leafNormal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughness: 0.92,
      metalness: 0.0
    });

    const coneBase = this.makeDroopyCone(2.75, 5.4);
    const UP = new THREE.Vector3(0, 1, 0);
    const tmpM = new THREE.Matrix4();
    const place = (geo, pos, quat, scl) => {
      const g = geo.clone();
      g.applyMatrix4(tmpM.compose(pos, quat, scl));
      return g;
    };

    // Generate 175 Pohon Pinus Raksasa & Pohon Mati Bercabang Seram
    for (let i = 0; i < 175; i++) {
      const x = (Math.random() - 0.5) * 135;
      const z = (Math.random() - 0.5) * 135;

      if (Math.hypot(x, z) < 5.5) continue;

      const isDead = Math.random() < 0.28;
      const height = 10 + Math.random() * 8;
      const radius = 0.36 + Math.random() * 0.28;
      const topR = radius * (isDead ? 0.42 : 0.60);

      // Batang berotot & bengkok alami
      const trunkGeo = new THREE.CylinderGeometry(topR, radius, height, 16, 14);
      trunkGeo.translate(0, height / 2, 0);
      const tp = trunkGeo.attributes.position;
      const phase = Math.random() * 6.28;
      const bend = 0.28 + Math.random() * 0.55;
      for (let k = 0; k < tp.count; k++) {
        const px = tp.getX(k), py = tp.getY(k), pz = tp.getZ(k);
        const t = py / height;
        const ang = Math.atan2(pz, px);
        // Alur otot akar & batang tua yang menonjol
        const rootFlute = (1 - Math.min(t * 3.2, 1)) * 0.22 * Math.cos(ang * 6 + phase);
        const lump = 1 + rootFlute + 0.08 * Math.sin(ang * 5 + py * 0.95 + phase) + 0.05 * Math.sin(ang * 3 + py * 2.3);
        tp.setXYZ(
          k,
          px * lump + Math.sin(py * 0.45 + phase) * bend * t * t,
          py,
          pz * lump + Math.cos(py * 0.38 + phase) * bend * t * t
        );
      }
      trunkGeo.computeVertexNormals();

      const parts = [trunkGeo];

      // Akar cakar menjalar di pangkal pohon
      const rootCount = 4 + Math.floor(Math.random() * 3);
      for (let r = 0; r < rootCount; r++) {
        const ra = (r / rootCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const rLen = 1.1 + Math.random() * 0.9;
        const rDir = new THREE.Vector3(Math.cos(ra) * 0.82, -0.57, Math.sin(ra) * 0.82).normalize();
        const rBase = new THREE.Vector3(Math.cos(ra) * radius * 0.7, 0.55, Math.sin(ra) * radius * 0.7);
        const rq = new THREE.Quaternion().setFromUnitVectors(UP, rDir);
        const rg = new THREE.CylinderGeometry(0.03, radius * 0.42, rLen, 8, 1);
        rg.translate(0, rLen / 2, 0);
        parts.push(place(rg, rBase, rq, new THREE.Vector3(1, 1, 1)));
      }

      const radiusAt = (y) => THREE.MathUtils.lerp(radius, topR, y / height);

      // Ranting tajam mencuat seperti tangan kerangka (melempar bayangan mengerikan)
      const branchCount = isDead ? 11 + Math.floor(Math.random() * 7) : 5 + Math.floor(Math.random() * 4);
      for (let b = 0; b < branchCount; b++) {
        const y = height * (isDead ? 0.18 + Math.random() * 0.76 : 0.15 + Math.random() * 0.45);
        const a = Math.random() * Math.PI * 2;
        const phi = THREE.MathUtils.degToRad(58 + Math.random() * 58);
        const len = (isDead ? 1.8 : 1.2) + Math.random() * 2.5;
        const br = 0.055 + Math.random() * 0.055;
        const dir = new THREE.Vector3(Math.cos(a) * Math.sin(phi), Math.cos(phi), Math.sin(a) * Math.sin(phi));
        const rr = radiusAt(y) * 0.9;
        const base = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
        const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);

        const bg = new THREE.CylinderGeometry(0.012, br, len, 7, 1);
        bg.translate(0, len / 2, 0);
        parts.push(place(bg, base, q, new THREE.Vector3(1, 1, 1)));

        const dir2 = dir.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.4
        )).normalize();
        const base2 = base.clone().addScaledVector(dir, len * (0.45 + Math.random() * 0.25));
        const q2 = new THREE.Quaternion().setFromUnitVectors(UP, dir2);
        const len2 = len * (0.42 + Math.random() * 0.35);
        const tg = new THREE.CylinderGeometry(0.007, br * 0.55, len2, 5, 1);
        tg.translate(0, len2 / 2, 0);
        parts.push(place(tg, base2, q2, new THREE.Vector3(1, 1, 1)));
      }

      const trunkMesh = new THREE.Mesh(mergeGeometries(parts), trunkMat);
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;
      parts.forEach((g) => g.dispose());

      const treeGroup = new THREE.Group();
      treeGroup.add(trunkMesh);

      if (!isDead) {
        const layers = [
          { y: height - 4.4, s: 1.32 },
          { y: height - 2.1, s: 1.06 },
          { y: height + 0.1, s: 0.82 },
          { y: height + 2.0, s: 0.52 }
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
        // Aktifkan castShadow & receiveShadow pada daun agar bayangan pohon utuh & realistis
        leafMesh.castShadow = true;
        leafMesh.receiveShadow = true;
        foliage.forEach((g) => g.dispose());
        treeGroup.add(leafMesh);
      } else {
        treeGroup.rotation.z = (Math.random() - 0.5) * 0.16;
        treeGroup.rotation.x = (Math.random() - 0.5) * 0.16;
      }

      treeGroup.position.set(x, 0, z);
      this.scene.add(treeGroup);

      this.treeColliders.push({ x, z, radius: radius + 0.36 });
    }

    // Batu Monolit / Nisan Tua Kuno di tengah hutan yang melempar bayangan panjang
    const rockMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      color: 0x2a2d2a,
      roughness: 0.96
    });
    for (let m = 0; m < 18; m++) {
      const rx = (Math.random() - 0.5) * 110;
      const rz = (Math.random() - 0.5) * 110;
      if (Math.hypot(rx, rz) < 8) continue;
      const rh = 1.4 + Math.random() * 2.2;
      const rw = 0.45 + Math.random() * 0.4;
      const rockGeo = new THREE.BoxGeometry(rw, rh, rw * 0.45, 4, 6, 4);
      const rp = rockGeo.attributes.position;
      for (let k = 0; k < rp.count; k++) {
        rp.setX(k, rp.getX(k) + (Math.random() - 0.5) * 0.08);
        rp.setZ(k, rp.getZ(k) + (Math.random() - 0.5) * 0.08);
      }
      rockGeo.computeVertexNormals();
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, rh / 2 - 0.1, rz);
      rock.rotation.y = Math.random() * Math.PI;
      rock.rotation.z = (Math.random() - 0.5) * 0.22;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
      this.treeColliders.push({ x: rx, z: rz, radius: rw * 0.7 });
    }

    // Partikel Kabut / Spora Melayang di udara hutan agar sorot cahaya terasa pekat & atmosferik
    this.createAtmosphericSpores();

    // Entitas Bayangan Pengintai Utama & Pengintai Kejauhan
    this.createStalkerEntity();
  }

  makeDroopyCone(R, H) {
    const geo = new THREE.ConeGeometry(R, H, 16, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(z, x);
      const t = r / R;
      const jag = 1 + (0.12 * Math.sin(a * 7) + 0.07 * Math.sin(a * 13 + 1.3)) * t;
      const droop = -0.60 * t * t * t;
      p.setXYZ(i, x * jag, y + droop, z * jag);
    }
    geo.computeVertexNormals();
    return geo;
  }

  createAtmosphericSpores() {
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 55;
      pos[i * 3 + 1] = 0.2 + Math.random() * 4.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 55;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x8a998c,
      size: 0.045,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    this.mistParticles = new THREE.Points(geo, mat);
    this.scene.add(this.mistParticles);
  }

  buildHorrorFigure(eyeColor = 0xffcc88) {
    const group = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x030303,
      roughness: 0.95
    });

    // Tubuh jangkung kurus tidak wajar
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.55, 6, 12), darkMat);
    torso.position.y = 1.25;
    torso.castShadow = true;
    group.add(torso);

    // Kepala sedikit miring menyeramkan
    const head = new THREE.Group();
    head.position.set(0, 2.22, 0.05);
    head.rotation.z = 0.18;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), darkMat);
    skull.scale.set(0.85, 1.25, 0.95);
    skull.castShadow = true;
    head.add(skull);

    // Mata menyala tajam di kegelapan
    const eyeGeo = new THREE.SphereGeometry(0.026, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.065, 0.03, 0.165);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.065, 0.03, 0.165);
    head.add(leftEye, rightEye);

    group.add(head);
    return group;
  }

  createStalkerEntity() {
    this.stalker = this.buildHorrorFigure(0xffe0a3);
    this.stalker.position.set(14, 0, -18);
    this.scene.add(this.stalker);

    // Dua siluet pengintai tambahan jauh di balik kabut
    for (let i = 0; i < 2; i++) {
      const watcher = this.buildHorrorFigure(0xcc2211);
      const ang = (i + 1) * 2.1;
      watcher.position.set(Math.cos(ang) * 28, 0, Math.sin(ang) * 28);
      this.scene.add(watcher);
      this.secondaryStalkers.push(watcher);
    }
  }

  update(playerPos, isFlashlightOn) {
    const t = performance.now() * 0.001;

    // Gerakkan partikel debu/spora melayang mengikuti area sekitar pemain
    if (this.mistParticles) {
      const arr = this.mistParticles.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += Math.sin(t + i) * 0.0015;
        // Jaga partikel tetap berada di sekitar radius pemain
        const dx = arr[i] - playerPos.x;
        const dz = arr[i + 2] - playerPos.z;
        if (dx > 27) arr[i] -= 54;
        if (dx < -27) arr[i] += 54;
        if (dz > 27) arr[i + 2] -= 54;
        if (dz < -27) arr[i + 2] += 54;
      }
      this.mistParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Entitas utama selalu menatap ke arah pemain
    if (this.stalker) {
      this.stalker.lookAt(playerPos.x, 0, playerPos.z);
      const dist = Math.hypot(
        playerPos.x - this.stalker.position.x,
        playerPos.z - this.stalker.position.z
      );

      // Jika pemain mematikan senter, entitas merayap mendekat perlahan
      if (!isFlashlightOn && dist > 5.0) {
        const dirX = (playerPos.x - this.stalker.position.x) / dist;
        const dirZ = (playerPos.z - this.stalker.position.z) / dist;
        this.stalker.position.x += dirX * 0.025;
        this.stalker.position.z += dirZ * 0.025;
      }

      if (dist < 7.5 && isFlashlightOn) {
        const angle = Math.random() * Math.PI * 2;
        const newDist = 17 + Math.random() * 14;
        this.stalker.position.set(
          playerPos.x + Math.cos(angle) * newDist,
          0,
          playerPos.z + Math.sin(angle) * newDist
        );
      }
    }

    for (const w of this.secondaryStalkers) {
      w.lookAt(playerPos.x, 0, playerPos.z);
      const wd = Math.hypot(playerPos.x - w.position.x, playerPos.z - w.position.z);
      if (wd < 11) {
        const a = Math.random() * Math.PI * 2;
        const nd = 24 + Math.random() * 16;
        w.position.set(playerPos.x + Math.cos(a) * nd, 0, playerPos.z + Math.sin(a) * nd);
      }
    }
  }
}
