import * as THREE from 'three';
import { HorrorAudioEngine } from './audio.js';
import { HorrorWorld } from './world.js';
import { FlashlightSystem } from './flashlight.js';
import { FirstPersonControls } from './controls.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  90
);
camera.position.set(0, 1.72, 0);

const audio = new HorrorAudioEngine();
const world = new HorrorWorld(scene);
const flashlight = new FlashlightSystem(camera, scene, audio);
const controls = new FirstPersonControls(camera, flashlight, audio, world.treeColliders);

let inGame = false;
const clock = new THREE.Clock();

// Tombol Mulai dari Lobby
const btnStart = document.getElementById('btn-start');
const lobbyScreen = document.getElementById('lobby-screen');
const hudScreen = document.getElementById('hud-screen');

btnStart.addEventListener('click', () => {
  audio.init();
  lobbyScreen.classList.add('hidden');
  hudScreen.classList.remove('hidden');
  inGame = true;
  controls.isActive = true;

  // Aktifkan Pointer Lock jika di PC/Desktop
  if (window.matchMedia('(pointer: fine)').matches && document.body.requestPointerLock) {
    document.body.requestPointerLock();
  }
});

// Klik di layar untuk mengunci kursor kembali saat di PC
canvas.addEventListener('click', () => {
  if (inGame && window.matchMedia('(pointer: fine)').matches && document.pointerLockElement !== document.body) {
    document.body.requestPointerLock();
  }
});

// Update Timecode VHS
function updateTimecode(elapsed) {
  const hrs = '02';
  const mins = String(14 + Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(Math.floor(elapsed % 60)).padStart(2, '0');
  const frames = String(Math.floor((elapsed * 24) % 24)).padStart(2, '0');
  const tcText = `${hrs}:${mins}:${secs}:${frames}`;

  document.getElementById('hud-timecode').textContent = tcText;
  document.getElementById('lobby-timecode').textContent = `TC ${tcText}`;
}

// Loop Utama
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.getElapsedTime();

  updateTimecode(elapsed);

  if (!inGame) {
    // Kamera berputar pelan di hutan saat masih di Lobby
    camera.position.x = Math.sin(elapsed * 0.15) * 2.5;
    camera.position.z = Math.cos(elapsed * 0.15) * 2.5;
    camera.lookAt(0, 1.5, -6);
  } else {
    controls.update(delta);
    world.update(camera.position, flashlight.isOn);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
