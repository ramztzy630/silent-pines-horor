import * as THREE from 'three';

export class FlashlightSystem {
  constructor(camera, scene, audioEngine) {
    this.camera = camera;
    this.audio = audioEngine;
    this.isOn = true;

    // Group pemegang senter di sudut kanan bawah kamera
    this.holder = new THREE.Group();
    this.camera.add(this.holder);

    // Body Senter 3D
    const bodyGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.24, 16);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.4,
      metalness: 0.8
    });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.set(0.22, -0.18, -0.35);
    this.holder.add(this.mesh);

    // Cahaya Utama Senter (SpotLight)
    this.spotLight = new THREE.SpotLight(0xfff6e0, 55, 42, Math.PI / 5.2, 0.55, 1.6);
    this.spotLight.position.set(0.22, -0.18, -0.45);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.width = 1024;
    this.spotLight.shadow.mapSize.height = 1024;

    this.target = new THREE.Object3D();
    this.target.position.set(0, -0.05, -8);
    this.camera.add(this.target);
    this.spotLight.target = this.target;
    this.camera.add(this.spotLight);

    // PointLight jarak sangat dekat untuk pantulan tangan/senter
    this.closeBounceLight = new THREE.PointLight(0xffeedd, 0.8, 3.5);
    this.closeBounceLight.position.set(0.15, -0.1, -0.5);
    this.camera.add(this.closeBounceLight);

    scene.add(this.camera);
  }

  toggle() {
    this.isOn = !this.isOn;

    // Pastikan cahaya benar-benar hilang total saat dimatikan
    this.spotLight.visible = this.isOn;
    this.spotLight.intensity = this.isOn ? 55 : 0;

    this.closeBounceLight.visible = this.isOn;
    this.closeBounceLight.intensity = this.isOn ? 0.8 : 0;

    this.audio.playFlashlightClick(this.isOn);

    // Update UI HUD & Tombol
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
