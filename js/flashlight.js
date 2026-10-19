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

    // Cahaya isi lemah (jarak pendek) supaya badan senter terlihat di tangan
    this.handFill = new THREE.PointLight(0xffe2c0, 0.7, 0.9, 2);
    this.handFill.position.set(0.06, 0.12, 0.1);
    this.camera.add(this.handFill);

    scene.add(this.camera);
    this.updateLayout();
    this.loadModel();
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
