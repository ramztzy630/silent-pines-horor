import * as THREE from 'three';

export class FlashlightSystem {
  constructor(camera, scene, audioEngine) {
    this.camera = camera;
    this.audio = audioEngine;
    this.isOn = true;

    // Cahaya Utama Senter (Tanpa objek 3D senter atau tangan di layar)
    // Ditempatkan sedikit di bawah-kanan sumbu mata agar sudut bayangan pohon terlihat dramatis & tiga dimensi
    this.spotLight = new THREE.SpotLight(0xfff3d6, 95, 52, Math.PI / 4.6, 0.62, 1.75);
    this.spotLight.position.set(0.12, -0.10, -0.08);
    this.spotLight.castShadow = true;

    // Shadow Map Resolusi Tinggi (HD) untuk bayangan batang & ranting pohon yang tajam
    this.spotLight.shadow.mapSize.set(2048, 2048);
    this.spotLight.shadow.camera.near = 0.15;
    this.spotLight.shadow.camera.far = 52;
    this.spotLight.shadow.focus = 0.92;
    this.spotLight.shadow.bias = -0.00035;
    this.spotLight.shadow.normalBias = 0.018;

    this.target = new THREE.Object3D();
    this.target.position.set(0, -0.04, -12);
    this.camera.add(this.target);
    this.spotLight.target = this.target;
    this.camera.add(this.spotLight);

    // Halo penyebaran cahaya jarak dekat (tanpa memunculkan model fisik)
    this.closeBounceLight = new THREE.PointLight(0xffe6c2, 0.55, 4.2, 2.0);
    this.closeBounceLight.position.set(0, -0.05, -0.35);
    this.camera.add(this.closeBounceLight);

    scene.add(this.camera);
  }

  updateLayout() {
    // Tidak ada mesh 3D senter/tangan yang perlu digeser
  }

  toggle() {
    this.isOn = !this.isOn;

    // Pastikan cahaya benar-benar hilang total saat dimatikan
    this.spotLight.visible = this.isOn;
    this.spotLight.intensity = this.isOn ? 95 : 0;

    this.closeBounceLight.visible = this.isOn;
    this.closeBounceLight.intensity = this.isOn ? 0.55 : 0;

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
