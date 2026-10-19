import * as THREE from 'three';

export class FirstPersonControls {
  constructor(camera, flashlight, audioEngine, treeColliders) {
    this.camera = camera;
    this.flashlight = flashlight;
    this.audio = audioEngine;
    this.colliders = treeColliders;

    this.isActive = false;
    this.isCrouching = false;

    this.standHeight = 1.72;
    this.crouchHeight = 0.92;
    this.currentHeight = this.standHeight;

    // Rotasi Kamera (Yaw & Pitch)
    this.yaw = 0;
    this.pitch = 0;

    // Input Vektor Gerakan (-1 sampai 1)
    this.moveInput = { x: 0, y: 0 };
    this.keys = {};
    this.bobTimer = 0;

    this.initKeyboardAndMouse();
    this.initTouchControls();
    this.initActionButtons();
  }

  initKeyboardAndMouse() {
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      const code = e.code;
      this.keys[code] = true;

      if (code === 'KeyF') this.flashlight.toggle();
      if (code === 'KeyC') this.toggleCrouch();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse look untuk Desktop
    window.addEventListener('mousemove', (e) => {
      if (!this.isActive || document.pointerLockElement !== document.body) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, this.pitch - e.movementY * 0.0022)
      );
    });
  }

  initTouchControls() {
    // 1. Virtual Joystick Kiri
    const joyZone = document.getElementById('joystick-zone');
    const joyStick = document.getElementById('joystick-stick');
    const maxRadius = 40;
    let joyTouchId = null;
    let joyOrigin = { x: 0, y: 0 };

    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      joyTouchId = touch.identifier;
      const rect = joyZone.getBoundingClientRect();
      joyOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    });

    joyZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === joyTouchId) {
          let dx = touch.clientX - joyOrigin.x;
          let dy = touch.clientY - joyOrigin.y;
          const dist = Math.hypot(dx, dy);

          if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
          }

          joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
          this.moveInput.x = dx / maxRadius;
          this.moveInput.y = dy / maxRadius;
        }
      }
    });

    const resetJoystick = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === joyTouchId) {
          joyTouchId = null;
          joyStick.style.transform = `translate(0px, 0px)`;
          this.moveInput.x = 0;
          this.moveInput.y = 0;
        }
      }
    };

    joyZone.addEventListener('touchend', resetJoystick);
    joyZone.addEventListener('touchcancel', resetJoystick);

    // 2. Area Geser Kamera Kanan
    const lookZone = document.getElementById('look-zone');
    let lookTouchId = null;
    let lastLook = { x: 0, y: 0 };

    lookZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      lookTouchId = touch.identifier;
      lastLook = { x: touch.clientX, y: touch.clientY };
    });

    lookZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
          const dx = touch.clientX - lastLook.x;
          const dy = touch.clientY - lastLook.y;
          lastLook = { x: touch.clientX, y: touch.clientY };

          this.yaw -= dx * 0.0055;
          this.pitch = Math.max(
            -Math.PI / 2.3,
            Math.min(Math.PI / 2.3, this.pitch - dy * 0.0055)
          );
        }
      }
    });

    const endLook = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) lookTouchId = null;
      }
    };

    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);
  }

  initActionButtons() {
    const btnFlash = document.getElementById('btn-flashlight');
    const btnCrouch = document.getElementById('btn-crouch');

    btnFlash.addEventListener('click', (e) => {
      e.stopPropagation();
      this.flashlight.toggle();
    });

    btnCrouch.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCrouch();
    });
  }

  toggleCrouch() {
    this.isCrouching = !this.isCrouching;
    const stanceEl = document.getElementById('stance-state');
    const btnCrouch = document.getElementById('btn-crouch');

    if (this.isCrouching) {
      stanceEl.textContent = 'CROUCH';
      stanceEl.className = 'state-on';
      btnCrouch.classList.add('active');
    } else {
      stanceEl.textContent = 'STAND';
      stanceEl.className = '';
      btnCrouch.classList.remove('active');
    }
  }

  update(delta) {
    if (!this.isActive) return;

    // Interpolasi halus tinggi kamera saat berdiri / jongkok
    const targetHeight = this.isCrouching ? this.crouchHeight : this.standHeight;
    this.currentHeight += (targetHeight - this.currentHeight) * 10 * delta;

    // Gabungkan input Keyboard & Virtual Joystick
    let forward = -this.moveInput.y;
    let strafe = this.moveInput.x;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward = -1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe = 1;

    const speed = this.isCrouching ? 1.85 : 3.6;
    const moveMag = Math.min(1, Math.hypot(forward, strafe));

    // Arah gerak berdasarkan orientasi Yaw kamera
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    const vx = (strafe * cosY - forward * sinY) * speed * delta;
    const vz = (-strafe * sinY - forward * cosY) * speed * delta;

    const nextX = this.camera.position.x + vx;
    const nextZ = this.camera.position.z + vz;

    // Cek Tabrakan dengan Pohon
    let canMove = true;
    for (const tree of this.colliders) {
      if (Math.hypot(nextX - tree.x, nextZ - tree.z) < tree.radius) {
        canMove = false;
        break;
      }
    }

    if (canMove) {
      this.camera.position.x = nextX;
      this.camera.position.z = nextZ;
    }

    // Headbob & Suara Langkah Kaki
    if (moveMag > 0.15) {
      const bobFreq = this.isCrouching ? 6 : 9.5;
      const prevSin = Math.sin(this.bobTimer);
      this.bobTimer += delta * bobFreq;
      const currSin = Math.sin(this.bobTimer);

      if (prevSin < 0 && currSin >= 0) {
        this.audio.playFootstep(this.isCrouching);
      }

      const bobOffset = currSin * (this.isCrouching ? 0.025 : 0.055);
      this.camera.position.y = this.currentHeight + bobOffset;
    } else {
      this.camera.position.y = this.currentHeight;
    }

    // Terapkan rotasi kamera
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }
}
