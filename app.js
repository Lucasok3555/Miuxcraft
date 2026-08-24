import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const BLOCKS = [
  { id: 'grass', name: 'Grama', color: 0x5fa34d },
  { id: 'stone', name: 'Pedra', color: 0x7d7d7d },
  { id: 'water', name: 'Agua', color: 0x4aa7da, transparent: true, opacity: 0.75, liquid: true },
  { id: 'wood', name: 'Madeira', color: 0x8d5f34 },
  { id: 'smooth_stone', name: 'Pedra lisa', color: 0xa0a0a0 },
  { id: 'leaf', name: 'Folha', color: 0x3a7a39, transparent: true, opacity: 0.9 },
  { id: 'fire', name: 'Fogo', color: 0xff7a1a, emissive: 0xff6600 },
  { id: 'lava', name: 'Lava', color: 0xd24e1f, emissive: 0xff4400 },
  { id: 'brick', name: 'Tijolos', color: 0xa84d3c },
  { id: 'wool', name: 'La', color: 0xe4e0d5 },
  { id: 'cement', name: 'Cimento', color: 0x939ba3 },
  { id: 'sand', name: 'Areia', color: 0xd9c27a },
  { id: 'coal', name: 'Carvao', color: 0x2d2d2d },
  { id: 'gravel', name: 'Cascalho', color: 0x8a8175 },
  { id: 'dirt', name: 'Terra', color: 0x7f5938 },
  { id: 'glass', name: 'Vidro', color: 0xbfe6f2, transparent: true, opacity: 0.35 }
];

const HOTBAR_IDS = ['grass', 'stone', 'wood', 'sand', 'glass', 'water', 'brick', 'lava'];
const WORLD_SIZE = 28;
const WATER_LEVEL = 4;
const PLAYER_HEIGHT = 1.8;
const BLOCK_SIZE = 1;
const STORAGE_KEY = 'voxel-sandbox-worlds-v1';

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const worldNameInput = document.getElementById('world-name-input');
const createWorldBtn = document.getElementById('create-world-btn');
const exportWorldBtn = document.getElementById('export-world-btn');
const worldList = document.getElementById('world-list');
const worldStatus = document.getElementById('world-status');
const selectedBlockLabel = document.getElementById('selected-block-label');
const pauseBtn = document.getElementById('pause-btn');
const hotbarEl = document.getElementById('hotbar');
const inventoryPanel = document.getElementById('inventory-panel');
const inventoryGrid = document.getElementById('inventory-grid');
const pausePanel = document.getElementById('pause-panel');
const closeInventoryBtn = document.getElementById('close-inventory-btn');
const inventoryBtn = document.getElementById('inventory-btn');
const saveExitBtn = document.getElementById('save-exit-btn');
const jumpBtn = document.getElementById('jump-btn');
const breakBtn = document.getElementById('break-btn');
const placeBtn = document.getElementById('place-btn');
const canvas = document.getElementById('game-canvas');

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x96d2ff, 16, 58);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const ambientLight = new THREE.HemisphereLight(0xbfdfff, 0x33411f, 0.95);
const sunLight = new THREE.DirectionalLight(0xfff0b8, 1.2);
sunLight.position.set(12, 24, 10);
sunLight.castShadow = true;
scene.add(ambientLight, sunLight);

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.4, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd86b })
);
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xdbe9ff })
);
scene.add(sunMesh, moonMesh);

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const gravity = 22;

const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const materials = new Map();
const blocks = new Map();
const blockMeshes = [];
const mobs = [];

const worldGroup = new THREE.Group();
const rainGroup = new THREE.Group();
scene.add(worldGroup, rainGroup);

const player = {
  position: new THREE.Vector3(WORLD_SIZE / 2, 9, WORLD_SIZE / 2),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.2,
  onGround: false
};

const controlState = {
  forward: 0,
  right: 0,
  jump: false,
  lookDX: 0,
  lookDY: 0,
  actionMode: 'break',
  pointerLocked: false,
  moveTouchId: null,
  lookTouchId: null,
  joystickVector: new THREE.Vector2(),
  lastLookPoint: null,
  touchLookMoved: false,
  touchLookStartTime: 0
};

let currentWorld = null;
let selectedWorldId = null;
let selectedBlockId = HOTBAR_IDS[0];
let timeOfDay = 0.28;
let weather = { raining: false, timer: 18 };

function createMaterial(def) {
  if (materials.has(def.id)) {
    return materials.get(def.id);
  }
  const material = new THREE.MeshStandardMaterial({
    color: def.color,
    transparent: Boolean(def.transparent),
    opacity: def.opacity ?? 1,
    emissive: def.emissive ?? 0x000000,
    roughness: def.transparent ? 0.25 : 1
  });
  materials.set(def.id, material);
  return material;
}

function keyFor(x, y, z) {
  return `${x}|${y}|${z}`;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function stringSeed(text) {
  return text.split('').reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

function terrainHeight(x, z, rand) {
  const ridge = Math.sin((x + rand * 11) * 0.35) + Math.cos((z - rand * 7) * 0.31);
  const hills = Math.sin((x + z) * 0.16) * 1.6 + Math.cos((x - z) * 0.21) * 1.2;
  return Math.max(3, Math.min(10, Math.floor(5 + ridge * 0.8 + hills * 0.6)));
}

function blockDef(id) {
  return BLOCKS.find((block) => block.id === id);
}

function getStoredWorlds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredWorlds(worlds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(worlds));
}

function upsertWorld(world) {
  const worlds = getStoredWorlds();
  const index = worlds.findIndex((item) => item.id === world.id);
  if (index >= 0) {
    worlds[index] = world;
  } else {
    worlds.push(world);
  }
  saveStoredWorlds(worlds);
}

function generateWorldData(name) {
  const seed = stringSeed(name || `mundo-${Date.now()}`);
  const rand = seededRandom(seed);
  const world = {
    id: `world-${Date.now()}`,
    name: name || 'Novo mundo',
    seed,
    createdAt: new Date().toISOString(),
    player: { x: WORLD_SIZE / 2, y: 9, z: WORLD_SIZE / 2, yaw: 0, pitch: -0.2 },
    blocks: []
  };
  const placed = new Set();
  const addBlock = (x, y, z, type) => {
    const mapKey = keyFor(x, y, z);
    if (placed.has(mapKey)) {
      return;
    }
    placed.add(mapKey);
    world.blocks.push({ x, y, z, type });
  };

  for (let x = 0; x < WORLD_SIZE; x += 1) {
    for (let z = 0; z < WORLD_SIZE; z += 1) {
      const h = terrainHeight(x, z, rand());
      const riverNoise = Math.sin((x + seed) * 0.12) + Math.cos((z - seed) * 0.14);
      const lakeNoise = Math.sin((x * z + seed) * 0.035);
      const hasWater = riverNoise > 1.3 || lakeNoise > 0.93;
      for (let y = 0; y <= h; y += 1) {
        let type = 'stone';
        if (y === h) {
          type = h <= WATER_LEVEL + 1 ? 'sand' : 'grass';
        } else if (y >= h - 2) {
          type = 'dirt';
        }
        addBlock(x, y, z, type);
      }

      if (hasWater && h <= WATER_LEVEL + 2) {
        for (let y = h + 1; y <= WATER_LEVEL; y += 1) {
          addBlock(x, y, z, 'water');
        }
      }

      if (!hasWater && h > WATER_LEVEL + 1 && rand() > 0.92) {
        generateTree(x, h + 1, z, addBlock, rand);
      }
    }
  }

  if (!world.blocks.some((entry) => entry.type === 'lava')) {
    for (let i = 0; i < 6; i += 1) {
      const x = Math.floor(rand() * WORLD_SIZE);
      const z = Math.floor(rand() * WORLD_SIZE);
      addBlock(x, 2, z, 'lava');
    }
  }
  return world;
}

function generateTree(x, y, z, addBlock, rand) {
  const height = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < height; i += 1) {
    addBlock(x, y + i, z, 'wood');
  }
  for (let ox = -2; ox <= 2; ox += 1) {
    for (let oz = -2; oz <= 2; oz += 1) {
      for (let oy = height - 2; oy <= height; oy += 1) {
        const spread = Math.abs(ox) + Math.abs(oz);
        if (spread < 4 && rand() > 0.15) {
          addBlock(x + ox, y + oy, z + oz, 'leaf');
        }
      }
    }
  }
}

function clearWorldScene() {
  for (const mesh of blockMeshes) {
    worldGroup.remove(mesh);
  }
  blockMeshes.length = 0;
  blocks.clear();

  while (mobs.length) {
    const mob = mobs.pop();
    worldGroup.remove(mob.group);
  }
}

function addBlockMesh(entry) {
  const def = blockDef(entry.type);
  if (!def) {
    return;
  }
  const mesh = new THREE.Mesh(blockGeometry, createMaterial(def));
  mesh.position.set(entry.x + 0.5, entry.y + 0.5, entry.z + 0.5);
  mesh.castShadow = !def.transparent;
  mesh.receiveShadow = true;
  mesh.userData = { type: entry.type, x: entry.x, y: entry.y, z: entry.z };
  worldGroup.add(mesh);
  blockMeshes.push(mesh);
  blocks.set(keyFor(entry.x, entry.y, entry.z), mesh);
}

function loadWorld(world) {
  currentWorld = structuredClone(world);
  clearWorldScene();
  currentWorld.blocks.forEach(addBlockMesh);
  player.position.set(currentWorld.player.x, currentWorld.player.y, currentWorld.player.z);
  player.velocity.set(0, 0, 0);
  player.yaw = currentWorld.player.yaw ?? 0;
  player.pitch = currentWorld.player.pitch ?? -0.2;
  createMobs();
  updateCamera();
}

function saveCurrentWorld() {
  if (!currentWorld) {
    return;
  }
  currentWorld.player = {
    x: Number(player.position.x.toFixed(2)),
    y: Number(player.position.y.toFixed(2)),
    z: Number(player.position.z.toFixed(2)),
    yaw: player.yaw,
    pitch: player.pitch
  };
  currentWorld.blocks = [...blocks.values()].map((mesh) => ({
    x: mesh.userData.x,
    y: mesh.userData.y,
    z: mesh.userData.z,
    type: mesh.userData.type
  }));
  upsertWorld(currentWorld);
}

function renderWorldList() {
  const worlds = getStoredWorlds();
  worldList.innerHTML = '';
  if (!worlds.length) {
    worldList.innerHTML = '<p>Nenhum mundo criado ainda.</p>';
    exportWorldBtn.disabled = true;
    return;
  }

  worlds.forEach((world) => {
    const card = document.createElement('div');
    card.className = `world-card${selectedWorldId === world.id ? ' selected' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'world-meta';
    meta.innerHTML = `<strong>${world.name}</strong><small>Seed ${world.seed} • ${new Date(world.createdAt).toLocaleString('pt-BR')}</small>`;

    const actions = document.createElement('div');
    actions.className = 'world-card-actions';
    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Selecionar';
    selectBtn.onclick = () => {
      selectedWorldId = world.id;
      exportWorldBtn.disabled = false;
      renderWorldList();
    };

    const enterBtn = document.createElement('button');
    enterBtn.textContent = 'Entrar';
    enterBtn.onclick = () => enterWorld(world.id);

    actions.append(selectBtn, enterBtn);
    card.append(meta, actions);
    worldList.append(card);
  });
}

function enterWorld(worldId) {
  const world = getStoredWorlds().find((item) => item.id === worldId);
  if (!world) {
    return;
  }
  loadWorld(world);
  menuScreen.classList.remove('active');
  gameScreen.classList.add('active');
  pausePanel.classList.add('hidden');
  inventoryPanel.classList.add('hidden');
}

function exitToMenu() {
  saveCurrentWorld();
  gameScreen.classList.remove('active');
  menuScreen.classList.add('active');
  controlState.pointerLocked = false;
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
  renderWorldList();
}

function addBlockAt(x, y, z, type) {
  if (blocks.has(keyFor(x, y, z))) {
    return false;
  }
  const entry = { x, y, z, type };
  addBlockMesh(entry);
  return true;
}

function removeBlockAt(x, y, z) {
  const block = blocks.get(keyFor(x, y, z));
  if (!block) {
    return false;
  }
  worldGroup.remove(block);
  blockMeshes.splice(blockMeshes.indexOf(block), 1);
  blocks.delete(keyFor(x, y, z));
  return true;
}

function findTargetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(blockMeshes, false);
  return intersects.find((hit) => hit.distance <= 6) || null;
}

function interact(place) {
  if (!currentWorld || inventoryPanel.classList.contains('hidden') === false) {
    return;
  }
  const hit = findTargetBlock();
  if (!hit) {
    return;
  }
  const { x, y, z } = hit.object.userData;
  if (!place) {
    if (y <= 0) {
      return;
    }
    removeBlockAt(x, y, z);
    return;
  }
  const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.5));
  const nx = Math.floor(pos.x);
  const ny = Math.floor(pos.y);
  const nz = Math.floor(pos.z);
  const playerFeet = player.position.clone();
  const dx = Math.abs(nx + 0.5 - playerFeet.x);
  const dy = Math.abs(ny + 0.5 - (playerFeet.y - 0.8));
  const dz = Math.abs(nz + 0.5 - playerFeet.z);
  if (dx < 0.8 && dy < 1.9 && dz < 0.8) {
    return;
  }
  addBlockAt(nx, ny, nz, selectedBlockId);
}

function updateCamera() {
  camera.position.copy(player.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function isSolidAt(x, y, z) {
  const mesh = blocks.get(keyFor(Math.floor(x), Math.floor(y), Math.floor(z)));
  if (!mesh) {
    return false;
  }
  const def = blockDef(mesh.userData.type);
  return !def?.liquid && mesh.userData.type !== 'leaf' && mesh.userData.type !== 'fire';
}

function updatePlayer(delta) {
  const moveInput = new THREE.Vector3(controlState.right, 0, controlState.forward);
  if (isTouchDevice) {
    moveInput.set(controlState.joystickVector.x, 0, -controlState.joystickVector.y);
  }
  if (moveInput.lengthSq() > 0) {
    moveInput.normalize();
  }

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const move = forward.multiplyScalar(moveInput.z).add(right.multiplyScalar(moveInput.x));
  const speed = 5.4;
  player.velocity.x = move.x * speed;
  player.velocity.z = move.z * speed;

  if (player.onGround && controlState.jump) {
    player.velocity.y = 8.5;
    player.onGround = false;
  }

  player.velocity.y -= gravity * delta;
  const next = player.position.clone().addScaledVector(player.velocity, delta);

  const footY = next.y - PLAYER_HEIGHT;
  const headY = next.y - 0.2;
  if (isSolidAt(next.x, footY, next.z) || isSolidAt(next.x, headY, next.z)) {
    next.x = player.position.x;
    next.z = player.position.z;
  }

  if (isSolidAt(next.x, next.y - PLAYER_HEIGHT, next.z)) {
    next.y = Math.floor(next.y - PLAYER_HEIGHT) + PLAYER_HEIGHT + 1;
    player.velocity.y = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  if (next.y < 2) {
    next.set(WORLD_SIZE / 2, 10, WORLD_SIZE / 2);
    player.velocity.set(0, 0, 0);
  }

  player.position.copy(next);
  player.yaw -= controlState.lookDX * 0.0022;
  player.pitch -= controlState.lookDY * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.45, 1.45);
  controlState.lookDX = 0;
  controlState.lookDY = 0;
  updateCamera();
}

function updateSky(delta) {
  timeOfDay = (timeOfDay + delta * 0.012) % 1;
  const angle = timeOfDay * Math.PI * 2;
  const dayFactor = Math.max(0.08, Math.sin(angle) * 0.5 + 0.5);
  scene.background = new THREE.Color().setHSL(0.57, 0.6, 0.18 + dayFactor * 0.52);
  scene.fog.color.copy(scene.background);
  ambientLight.intensity = 0.28 + dayFactor * 0.95;
  sunLight.intensity = 0.15 + dayFactor * 1.25;
  sunLight.color.setHSL(0.12, 0.8, 0.55 + dayFactor * 0.2);

  const orbitRadius = 24;
  sunMesh.position.set(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius + 8, 0);
  moonMesh.position.set(Math.cos(angle + Math.PI) * orbitRadius, Math.sin(angle + Math.PI) * orbitRadius + 8, 0);
  sunLight.position.copy(sunMesh.position);
  worldStatus.textContent = dayFactor > 0.55 ? 'Dia claro' : dayFactor > 0.2 ? 'Entardecer' : 'Noite';
}

function createMobs() {
  const mobDefs = [
    { name: 'Vaca', body: 0x6b4c35, spots: 0xe7dfd5 },
    { name: 'Porco', body: 0xf0a6b8, spots: 0xf7c7d5 },
    { name: 'Ovelha', body: 0xf2f2f2, spots: 0xd9d9d9 }
  ];
  for (let i = 0; i < 6; i += 1) {
    const type = mobDefs[i % mobDefs.length];
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 0.7),
      new THREE.MeshStandardMaterial({ color: type.body })
    );
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.45, 0.45),
      new THREE.MeshStandardMaterial({ color: type.spots })
    );
    body.castShadow = head.castShadow = true;
    head.position.set(0.7, 0.15, 0);
    group.add(body, head);
    group.position.set(4 + i * 3, 8, 4 + (i % 3) * 5);
    worldGroup.add(group);
    mobs.push({ group, dir: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.2, timer: 0, name: type.name });
  }
}

function highestBlockAt(x, z) {
  for (let y = 14; y >= 0; y -= 1) {
    if (blocks.has(keyFor(x, y, z))) {
      return y;
    }
  }
  return 0;
}

function updateMobs(delta) {
  for (const mob of mobs) {
    mob.timer -= delta;
    if (mob.timer <= 0) {
      mob.timer = 2 + Math.random() * 3;
      mob.dir += (Math.random() - 0.5) * 1.4;
    }
    mob.group.position.x += Math.sin(mob.dir) * mob.speed * delta;
    mob.group.position.z += Math.cos(mob.dir) * mob.speed * delta;
    mob.group.position.x = THREE.MathUtils.clamp(mob.group.position.x, 1, WORLD_SIZE - 2);
    mob.group.position.z = THREE.MathUtils.clamp(mob.group.position.z, 1, WORLD_SIZE - 2);
    const gx = Math.floor(mob.group.position.x);
    const gz = Math.floor(mob.group.position.z);
    mob.group.position.y = highestBlockAt(gx, gz) + 1.45;
    mob.group.rotation.y = mob.dir;
  }
}

function refreshRain() {
  rainGroup.clear();
  if (!weather.raining) {
    return;
  }
  const material = new THREE.LineBasicMaterial({ color: 0x92bff7, transparent: true, opacity: 0.45 });
  for (let i = 0; i < 220; i += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.45, 0)
    ]);
    const drop = new THREE.Line(geometry, material);
    drop.position.set(Math.random() * WORLD_SIZE, 8 + Math.random() * 12, Math.random() * WORLD_SIZE);
    rainGroup.add(drop);
  }
}

function updateWeather(delta) {
  weather.timer -= delta;
  if (weather.timer <= 0) {
    weather.raining = !weather.raining;
    weather.timer = weather.raining ? 24 + Math.random() * 18 : 30 + Math.random() * 24;
    refreshRain();
  }
  if (weather.raining) {
    const storm = Math.max(0.6, Math.sin(clock.elapsedTime * 12) * 0.12 + 0.88);
    ambientLight.intensity *= storm;
    worldStatus.textContent += ' • Chuva';
    for (const drop of rainGroup.children) {
      drop.position.y -= delta * 11;
      if (drop.position.y < 0) {
        drop.position.set(Math.random() * WORLD_SIZE, 16 + Math.random() * 8, Math.random() * WORLD_SIZE);
      }
    }
  }
}

function buildHotbar() {
  hotbarEl.innerHTML = '';
  HOTBAR_IDS.forEach((id, index) => {
    const def = blockDef(id);
    const button = document.createElement('button');
    button.className = `hotbar-slot${id === selectedBlockId ? ' active' : ''}`;
    button.style.background = `#${def.color.toString(16).padStart(6, '0')}`;
    button.textContent = def.name;
    button.onclick = () => selectBlock(id);
    hotbarEl.append(button);
    if (index === 0) {
      selectedBlockLabel.textContent = `Bloco: ${def.name}`;
    }
  });
}

function buildInventory() {
  inventoryGrid.innerHTML = '';
  BLOCKS.forEach((def) => {
    const item = document.createElement('button');
    item.className = 'inventory-item';
    item.style.background = `#${def.color.toString(16).padStart(6, '0')}`;
    item.textContent = def.name;
    item.onclick = () => {
      selectBlock(def.id);
      inventoryPanel.classList.add('hidden');
    };
    inventoryGrid.append(item);
  });
}

function selectBlock(id) {
  selectedBlockId = id;
  buildHotbar();
  selectedBlockLabel.textContent = `Bloco: ${blockDef(id)?.name ?? id}`;
}

function exportSelectedWorld() {
  const world = getStoredWorlds().find((item) => item.id === selectedWorldId);
  if (!world) {
    return;
  }
  const blob = new Blob([JSON.stringify(world, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${world.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function onPrimaryAction(place) {
  if (isTouchDevice) {
    interact(place);
  } else {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
      return;
    }
    interact(place);
  }
}

function togglePause(forceVisible = null) {
  const shouldShow = forceVisible ?? pausePanel.classList.contains('hidden');
  pausePanel.classList.toggle('hidden', !shouldShow);
  if (shouldShow && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (gameScreen.classList.contains('active') && currentWorld) {
    updatePlayer(delta);
    updateSky(delta);
    updateWeather(delta);
    updateMobs(delta);
  }
  renderer.render(scene, camera);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setKey(code, pressed) {
  if (code === 'KeyW') controlState.forward = pressed ? 1 : (controlState.forward === 1 ? 0 : controlState.forward);
  if (code === 'KeyS') controlState.forward = pressed ? -1 : (controlState.forward === -1 ? 0 : controlState.forward);
  if (code === 'KeyA') controlState.right = pressed ? -1 : (controlState.right === -1 ? 0 : controlState.right);
  if (code === 'KeyD') controlState.right = pressed ? 1 : (controlState.right === 1 ? 0 : controlState.right);
  if (code === 'Space') controlState.jump = pressed;
}

window.addEventListener('resize', resize);
document.addEventListener('pointerlockchange', () => {
  controlState.pointerLocked = document.pointerLockElement === canvas;
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && gameScreen.classList.contains('active')) {
    togglePause();
    return;
  }
  setKey(event.code, true);
  const slotIndex = Number(event.key) - 1;
  if (slotIndex >= 0 && slotIndex < HOTBAR_IDS.length) {
    selectBlock(HOTBAR_IDS[slotIndex]);
  }
});

window.addEventListener('keyup', (event) => setKey(event.code, false));

canvas.addEventListener('click', () => {
  if (!isTouchDevice && document.pointerLockElement !== canvas && gameScreen.classList.contains('active')) {
    canvas.requestPointerLock();
  }
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('mousedown', (event) => {
  if (inventoryPanel.classList.contains('hidden') === false) {
    return;
  }
  if (event.button === 0) interact(false);
  if (event.button === 2) interact(true);
});

window.addEventListener('mousemove', (event) => {
  if (controlState.pointerLocked) {
    controlState.lookDX += event.movementX;
    controlState.lookDY += event.movementY;
  }
});

function updateJoystick(clientX, clientY) {
  const zone = document.getElementById('joystick-zone').getBoundingClientRect();
  const cx = zone.left + zone.width / 2;
  const cy = zone.top + zone.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const max = 44;
  const length = Math.min(max, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * length;
  const y = Math.sin(angle) * length;
  document.getElementById('joystick-thumb').style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  controlState.joystickVector.set(x / max, y / max);
}

function resetJoystick() {
  document.getElementById('joystick-thumb').style.transform = 'translate(-50%, -50%)';
  controlState.joystickVector.set(0, 0);
}

window.addEventListener('touchstart', (event) => {
  if (!gameScreen.classList.contains('active')) {
    return;
  }
  for (const touch of event.changedTouches) {
    if (touch.clientX < window.innerWidth * 0.4 && controlState.moveTouchId === null) {
      controlState.moveTouchId = touch.identifier;
      updateJoystick(touch.clientX, touch.clientY);
    } else if (controlState.lookTouchId === null) {
      controlState.lookTouchId = touch.identifier;
      controlState.lastLookPoint = { x: touch.clientX, y: touch.clientY };
      controlState.touchLookMoved = false;
      controlState.touchLookStartTime = performance.now();
    }
  }
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  for (const touch of event.changedTouches) {
    if (touch.identifier === controlState.moveTouchId) {
      updateJoystick(touch.clientX, touch.clientY);
    } else if (touch.identifier === controlState.lookTouchId && controlState.lastLookPoint) {
      controlState.lookDX += touch.clientX - controlState.lastLookPoint.x;
      controlState.lookDY += touch.clientY - controlState.lastLookPoint.y;
      if (Math.abs(touch.clientX - controlState.lastLookPoint.x) > 4 || Math.abs(touch.clientY - controlState.lastLookPoint.y) > 4) {
        controlState.touchLookMoved = true;
      }
      controlState.lastLookPoint = { x: touch.clientX, y: touch.clientY };
    }
  }
}, { passive: true });

window.addEventListener('touchend', (event) => {
  for (const touch of event.changedTouches) {
    if (touch.identifier === controlState.moveTouchId) {
      controlState.moveTouchId = null;
      resetJoystick();
    }
    if (touch.identifier === controlState.lookTouchId) {
      const tapDuration = performance.now() - controlState.touchLookStartTime;
      if (!controlState.touchLookMoved && tapDuration < 220 && touch.clientX > window.innerWidth * 0.4) {
        interact(controlState.actionMode === 'place');
      }
      controlState.lookTouchId = null;
      controlState.lastLookPoint = null;
      controlState.touchLookMoved = false;
    }
  }
}, { passive: true });

createWorldBtn.onclick = () => {
  const world = generateWorldData(worldNameInput.value.trim());
  upsertWorld(world);
  selectedWorldId = world.id;
  worldNameInput.value = '';
  renderWorldList();
};

exportWorldBtn.onclick = exportSelectedWorld;
inventoryBtn.onclick = () => inventoryPanel.classList.toggle('hidden');
closeInventoryBtn.onclick = () => inventoryPanel.classList.add('hidden');
saveExitBtn.onclick = exitToMenu;
pauseBtn.onclick = () => togglePause(true);
jumpBtn.onclick = () => {
  controlState.jump = true;
  window.setTimeout(() => { controlState.jump = false; }, 120);
};
breakBtn.onclick = () => {
  controlState.actionMode = 'break';
  onPrimaryAction(false);
};
placeBtn.onclick = () => {
  controlState.actionMode = 'place';
  onPrimaryAction(true);
};

buildHotbar();
buildInventory();
renderWorldList();
refreshRain();
animate();
