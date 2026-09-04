import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.webgpu.js';
import FastNoiseLite from 'https://cdn.jsdelivr.net/npm/fastnoise-lite@1.1.1/+esm';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm';

const CHUNK_SIZE = 16;
const BLOCK_SIZE = 1;
const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.3;
const CAPSULE_HALF_HEIGHT = Math.max(0.05, PLAYER_HEIGHT / 2 - PLAYER_RADIUS);
const WATER_LEVEL = 15;
const WORLD_BOTTOM = -96;
const STORAGE_KEY = 'voxel-sandbox-web-worlds-v2';
const MOD_STORAGE_KEY = 'voxel-sandbox-web-mods-v1';
const SETTINGS_KEY = 'voxel-sandbox-web-settings-v1';
const CHUNK_CACHE_VERSION = 'g3-rapier-fnl';

const BLOCKS = [
  { id: 'grass', name: 'Grama', color: 0x5da84d, solid: true },
  { id: 'stone', name: 'Pedra', color: 0x777a7d, solid: true },
  { id: 'water', name: 'Agua', color: 0x3a91d4, solid: false, transparent: true, opacity: 0.62 },
  { id: 'wood', name: 'Madeira', color: 0x8b5b32, solid: true },
  { id: 'smooth_stone', name: 'Pedra lisa', color: 0xa6a6a6, solid: true },
  { id: 'leaf', name: 'Folha', color: 0x3f8739, solid: false, transparent: true, opacity: 0.88 },
  { id: 'fire', name: 'Fogo', color: 0xff7d1f, solid: false, emissive: 0xff5216 },
  { id: 'lava', name: 'Lava', color: 0xd84b24, solid: false, emissive: 0xff3000 },
  { id: 'brick', name: 'Tijolos', color: 0x9d493c, solid: true },
  { id: 'wool', name: 'La branca', color: 0xe9e5dc, solid: true },
  { id: 'cement', name: 'Cimento', color: 0x90989d, solid: true },
  { id: 'sand', name: 'Areia', color: 0xd9c27d, solid: true },
  { id: 'quartz', name: 'Quartzo', color: 0xe6dfce, solid: true },
  { id: 'gravel', name: 'Cascalho', color: 0x817b72, solid: true },
  { id: 'dirt', name: 'Terra', color: 0x805737, solid: true },
  { id: 'glass', name: 'Vidro', color: 0xb7e5ee, solid: true, transparent: true, opacity: 0.35 },
  { id: 'door', name: 'Porta', color: 0x9b673a, solid: true },
  { id: 'furnace', name: 'Fogao', color: 0x4c4d50, solid: true },
  { id: 'tool_block', name: 'Ferramentas', color: 0x59656e, solid: true },
  { id: 'graphene', name: 'Grafeno', color: 0x1f2528, solid: true },
  { id: 'diamond_block', name: 'Diamante', color: 0x55dbe2, solid: true },
  { id: 'gold_block', name: 'Ouro', color: 0xf0c340, solid: true },
  { id: 'iron_block', name: 'Ferro', color: 0xc6c9c9, solid: true },
  { id: 'coal_block', name: 'Carvao', color: 0x252525, solid: true },
  { id: 'torch', name: 'Tocha', color: 0xffcf5d, solid: false, transparent: true, opacity: 0.95, emissive: 0xff9d1f, light: true },
  { id: 'light_block', name: 'Bloco de luz', color: 0xfff6d6, solid: true, emissive: 0xfff2b0, light: true }
];

const ITEMS = [
  ...BLOCKS,
  { id: 'axe', name: 'Machado', color: 0x9b8b64 },
  { id: 'pickaxe', name: 'Picareta', color: 0x8f98a1 },
  { id: 'shovel', name: 'Pa', color: 0xb29c73 },
  { id: 'hoe', name: 'Enxada', color: 0x947854 },
  { id: 'stick', name: 'Graveto', color: 0x9a6a37 },
  { id: 'sword', name: 'Espada', color: 0xb8c4ca }
];

const DEFAULT_HOTBAR = ['grass', 'stone', 'wood', 'sand', 'glass', 'water', 'brick', 'diamond_block', 'furnace'];
let HOTBAR = [...DEFAULT_HOTBAR];

const BIOMES = {
  forest: { name: 'Floresta', top: 'grass', treeChance: 0.1, grassChance: 0.18, fallenLogChance: 0.02, tint: 0x5da84d },
  snow: { name: 'Neve', top: 'wool', treeChance: 0.04, grassChance: 0.035, fallenLogChance: 0.01, tint: 0xe8edf0 },
  savanna: { name: 'Savana', top: 'grass', treeChance: 0.025, grassChance: 0.1, fallenLogChance: 0.008, tint: 0xb6ac5c },
  desert: { name: 'Deserto', top: 'sand', treeChance: 0.002, grassChance: 0, fallenLogChance: 0, tint: 0xd9c27d },
  plains: { name: 'Planicie', top: 'grass', treeChance: 0.035, grassChance: 0.15, fallenLogChance: 0.012, tint: 0x70a94f },
  mountains: { name: 'Montanhas', top: 'stone', treeChance: 0.012, grassChance: 0.02, fallenLogChance: 0.006, tint: 0x9096a0 }
};

const el = {
  home: document.getElementById('home-screen'),
  game: document.getElementById('game-screen'),
  canvas: document.getElementById('game-canvas'),
  worldName: document.getElementById('world-name-input'),
  gameMode: document.getElementById('game-mode-select'),
  createWorld: document.getElementById('create-world-btn'),
  downloadWorld: document.getElementById('download-world-btn'),
  worldList: document.getElementById('world-list'),
  onlineCodeInput: document.getElementById('online-code-input'),
  onlineTest: document.getElementById('online-test-btn'),
  joinOnline: document.getElementById('join-online-btn'),
  onlineStatus: document.getElementById('online-status'),
  onlineWorldList: document.getElementById('online-world-list'),
  modInput: document.getElementById('mod-file-input'),
  modList: document.getElementById('mod-list'),
  exportMod: document.getElementById('export-mod-btn'),
  fps: document.getElementById('fps-select'),
  renderDistance: document.getElementById('render-distance-select'),
  username: document.getElementById('username-input'),
  autoJump: document.getElementById('auto-jump-input'),
  topWorld: document.getElementById('world-label'),
  clock: document.getElementById('clock-label'),
  health: document.getElementById('health-label'),
  onlineTag: document.getElementById('online-tag'),
  messageToast: document.getElementById('world-message-toast'),
  pause: document.getElementById('pause-btn'),
  hotbar: document.getElementById('hotbar'),
  inventoryPanel: document.getElementById('inventory-panel'),
  pausePanel: document.getElementById('pause-panel'),
  sharePanel: document.getElementById('share-panel'),
  editWorldPanel: document.getElementById('edit-world-panel'),
  editWorldName: document.getElementById('edit-world-name-input'),
  editGameMode: document.getElementById('edit-game-mode-select'),
  saveEditWorld: document.getElementById('save-edit-world-btn'),
  cancelEditWorld: document.getElementById('cancel-edit-world-btn'),
  loadingPanel: document.getElementById('loading-panel'),
  loadingFill: document.getElementById('loading-fill'),
  loadingLabel: document.getElementById('loading-label'),
  deathPanel: document.getElementById('death-panel'),
  inventoryTitle: document.getElementById('inventory-title'),
  closeInventory: document.getElementById('close-inventory-btn'),
  blockSearch: document.getElementById('block-search-input'),
  creativeList: document.getElementById('creative-block-list'),
  survivalInventory: document.getElementById('survival-inventory'),
  craftingBox: document.getElementById('crafting-box'),
  craftingMessage: document.getElementById('crafting-message'),
  resume: document.getElementById('resume-btn'),
  shareWorld: document.getElementById('share-world-btn'),
  closeShare: document.getElementById('close-share-btn'),
  shareCodeOutput: document.getElementById('share-code-output'),
  shareStatus: document.getElementById('share-status'),
  pauseSettings: document.getElementById('pause-settings-btn'),
  saveExit: document.getElementById('save-exit-btn'),
  revive: document.getElementById('revive-btn'),
  deathExit: document.getElementById('death-exit-btn'),
  mobileInventory: document.getElementById('mobile-inventory-btn'),
  mobileJump: document.getElementById('mobile-jump-btn'),
  mobileBreak: document.getElementById('mobile-break-btn'),
  mobilePlace: document.getElementById('mobile-place-btn'),
  joystickZone: document.getElementById('joystick-zone'),
  joystickThumb: document.getElementById('joystick-thumb'),
  oxygen: document.getElementById('oxygen-label'),
  mobileCamera: document.getElementById('mobile-camera-btn'),
  mobileChat: document.getElementById('mobile-chat-btn'),
  chatPanel: document.getElementById('chat-panel'),
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input-field'),
  chatSend: document.getElementById('chat-send-btn'),
  chatClose: document.getElementById('chat-close-btn')
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 550);
const renderer = new THREE.WebGPURenderer({ canvas: el.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
let rendererReady = false;
renderer.init().then(() => { rendererReady = true; }).catch((err) => console.error('WebGPU init falhou:', err));

let physicsWorld = null;
let characterController = null;
let playerBody = null;
let playerCollider = null;
let rapierReady = false;
const blockColliders = new Map();

const physicsReadyPromise = RAPIER.init()
  .then(() => {
    physicsWorld = new RAPIER.World({ x: 0, y: -23, z: 0 });
    characterController = physicsWorld.createCharacterController(0.01);
    characterController.enableAutostep(0.55, 0.25, true);
    characterController.enableSnapToGround(0.4);
    characterController.setSlideEnabled(true);
    characterController.setMaxSlopeClimbAngle((60 * Math.PI) / 180);
    characterController.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      player.position.x,
      player.position.y - PLAYER_HEIGHT / 2,
      player.position.z
    );
    playerBody = physicsWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER_RADIUS);
    playerCollider = physicsWorld.createCollider(colliderDesc, playerBody);
    rapierReady = true;
  })
  .catch((err) => console.error('Rapier init falhou:', err));

function addBlockCollider(x, y, z, type) {
  if (!rapierReady) return;
  const def = blockDef(type);
  if (!def?.solid) return;
  const k = key(x, y, z);
  if (blockColliders.has(k)) return;
  const desc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(x + 0.5, y + 0.5, z + 0.5);
  blockColliders.set(k, physicsWorld.createCollider(desc));
}

function removeBlockCollider(x, y, z) {
  if (!rapierReady) return;
  const k = key(x, y, z);
  const collider = blockColliders.get(k);
  if (!collider) return;
  physicsWorld.removeCollider(collider, true);
  blockColliders.delete(k);
}

function syncPlayerBodyToPosition() {
  if (!rapierReady || !playerBody) return;
  playerBody.setNextKinematicTranslation({
    x: player.position.x,
    y: player.position.y - PLAYER_HEIGHT / 2,
    z: player.position.z
  });
  physicsWorld.step();
}

const hemi = new THREE.HemisphereLight(0xbfe7ff, 0x394128, 0.9);
const sun = new THREE.DirectionalLight(0xffefbd, 1.15);
sun.position.set(30, 52, 20);
sun.castShadow = true;
scene.add(hemi, sun);

const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 20), new THREE.MeshBasicMaterial({ color: 0xffcf5d }));
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 18), new THREE.MeshBasicMaterial({ color: 0xdce8ff }));
scene.add(sunMesh, moonMesh);

const worldGroup = new THREE.Group();
const weatherGroup = new THREE.Group();
const cloudGroup = new THREE.Group();
const dropGroup = new THREE.Group();
const playerAvatar = new THREE.Group();
scene.add(worldGroup, weatherGroup, cloudGroup, dropGroup, playerAvatar);

const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const tallGeo = new THREE.BoxGeometry(0.72, 1.8, 0.12);
const materials = new Map();
const chunks = new Map();
const loadedBlocks = new Map();
const blockMeshes = [];
const lightSources = new Map();
const drops = [];
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

const player = {
  position: new THREE.Vector3(0, 20, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.18,
  onGround: false,
  flyMode: false,
  lastSpaceTap: 0,
  health: 100,
  oxygen: 100,
  freeCam: false
};

const controls = {
  forward: 0,
  right: 0,
  jump: false,
  descend: false,
  lookDX: 0,
  lookDY: 0,
  pointerLocked: false,
  moveTouch: null,
  lookTouch: null,
  lastLook: null,
  joystick: new THREE.Vector2()
};

const freeCamState = {
  position: new THREE.Vector3(),
  yaw: 0,
  pitch: 0
};

let chatOpen = false;

let settings = loadSettings();
let worlds = loadWorlds();
let mods = loadMods();
let currentWorld = null;
let selectedWorldId = worlds[0]?.id ?? null;
let selectedItem = HOTBAR[0];
let timeOfDay = 0.22;
let weather = { kind: 'clear', timer: 22 };
let running = false;
let lastFrame = 0;
let accumulator = 0;
let onlineSession = null;
let editingWorldId = null;
let isOnlineActive = false;
let messageTimer = null;
let activePlayers = [];

function resolveUsernameConflict(name, existing = []) {
  let cleanName = name.trim() || 'Jogador';
  if (!existing.includes(cleanName)) return cleanName;
  let num = 2;
  while (existing.includes(`${cleanName} ${num}`)) {
    num += 1;
  }
  return `${cleanName} ${num}`;
}

function showWorldToast(text) {
  if (!el.messageToast) return;
  el.messageToast.textContent = text;
  el.messageToast.classList.remove('hidden');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    el.messageToast.classList.add('hidden');
  }, 4200);
}

function blockDef(id) {
  return BLOCKS.find((item) => item.id === id) || ITEMS.find((item) => item.id === id);
}

function materialFor(def) {
  if (materials.has(def.id)) return materials.get(def.id);
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    transparent: Boolean(def.transparent),
    opacity: def.opacity ?? 1,
    emissive: def.emissive ?? 0x000000,
    roughness: def.transparent ? 0.28 : 0.92
  });
  materials.set(def.id, mat);
  return mat;
}

function avatarMaterial(color) {
  const id = `avatar-${color}`;
  if (!materials.has(id)) {
    materials.set(id, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  }
  return materials.get(id);
}

function buildPlayerAvatar() {
  playerAvatar.clear();
  const skin = avatarMaterial(0xd7a36f);
  const shirt = avatarMaterial(0x3f77b6);
  const pants = avatarMaterial(0x263b63);
  const addPart = (name, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    playerAvatar.add(mesh);
  };
  addPart('head', [0.72, 0.72, 0.72], [0, 0.36, 0], skin);
  addPart('body', [0.78, 0.92, 0.36], [0, -0.48, 0], shirt);
  addPart('leftArm', [0.26, 0.86, 0.28], [-0.56, -0.48, 0], skin);
  addPart('rightArm', [0.26, 0.86, 0.28], [0.56, -0.48, 0], skin);
  addPart('leftLeg', [0.3, 0.82, 0.3], [-0.2, -1.32, 0], pants);
  addPart('rightLeg', [0.3, 0.82, 0.3], [0.2, -1.32, 0], pants);
  playerAvatar.visible = false;
}

function key(x, y, z) {
  return `${x}|${y}|${z}`;
}

function chunkKey(cx, cz) {
  return `${cx}|${cz}`;
}

function floorChunk(v) {
  return Math.floor(v / CHUNK_SIZE);
}

function hash(seed, x, z) {
  let n = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

const fnlCache = new Map();
function noiseGenerator(seed) {
  let gen = fnlCache.get(seed);
  if (!gen) {
    gen = new FastNoiseLite();
    gen.SetSeed(seed | 0);
    gen.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
    fnlCache.set(seed, gen);
  }
  return gen;
}

function smoothNoise(seed, x, z, scale) {
  const gen = noiseGenerator(seed);
  const raw = gen.GetNoise(x / scale, z / scale);
  return (raw + 1) / 2;
}

function noise(seed, x, z) {
  return (
    smoothNoise(seed, x, z, 80) * 0.48 +
    smoothNoise(seed + 11, x, z, 28) * 0.34 +
    smoothNoise(seed + 27, x, z, 11) * 0.18
  );
}

function worldSeed(text) {
  let seed = 2166136261;
  for (const char of text) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function desertIslandBumpAt(x, z) {
  const n = smoothNoise(currentWorld.seed + 900, x, z, 34);
  return n > 0.93 ? (n - 0.93) * 240 : 0;
}

function biomeAt(x, z) {
  if (desertIslandBumpAt(x, z) > 0.4) return 'desert';
  const h = heightAt(x, z);
  if (h > 30) return 'mountains';
  const n = noise(currentWorld.seed + 500, x, z);
  if (n < 0.19) return 'desert';
  if (n < 0.35) return 'savanna';
  if (n > 0.78) return 'snow';
  if (n > 0.58) return 'forest';
  return 'plains';
}

function heightAt(x, z) {
  const detail = smoothNoise(currentWorld.seed + 44, x, z, 7) - 0.5;
  const continent = noise(currentWorld.seed + 700, x, z);
  if (continent < 0.34) {
    const oceanDepth = 18 + (0.34 - continent) * 90;
    let floor = WATER_LEVEL - oceanDepth;
    const islandN = smoothNoise(currentWorld.seed + 950, x, z, 16);
    if (islandN > 0.85) {
      const bump = (islandN - 0.85) * 150;
      floor = Math.max(floor, WATER_LEVEL - 6) + bump;
    }
    return Math.floor(floor + detail * 2);
  }
  const base = noise(currentWorld.seed, x, z);
  const mountain = Math.pow(noise(currentWorld.seed + 90, x, z), 3) * 34;
  const rolling = Math.sin(x * 0.11) * 1.6 + Math.cos(z * 0.1) * 1.4;
  const island = Math.sin(x * 0.012) * Math.cos(z * 0.011) * 3;
  const desertIsland = desertIslandBumpAt(x, z);
  return Math.floor(8 + base * 21 + detail * 4 + rolling + mountain + island + desertIsland);
}

function riverAt(x, z) {
  const line = Math.abs(Math.sin((x + currentWorld.seed) * 0.028) + Math.cos((z - currentWorld.seed) * 0.031));
  return line < 0.1 && noise(currentWorld.seed + 125, x, z) > 0.48;
}

function terrainTopAt(x, z) {
  const h = heightAt(x, z);
  return riverAt(x, z) ? Math.min(h, WATER_LEVEL - 1) : h;
}

function ravineInfo(x, z) {
  const line = Math.abs(Math.sin((x + currentWorld.seed) * 0.013) + Math.cos((z - currentWorld.seed) * 0.017));
  const active = line < 0.082 && noise(currentWorld.seed + 330, x, z) > 0.48;
  const depth = 10 + Math.floor(noise(currentWorld.seed + 331, x, z) * 16);
  return { active, width: line, depth };
}

function ravineAt(x, z) {
  return ravineInfo(x, z).active;
}

function caveAt(x, y, z) {
  const h = terrainTopAt(x, z);
  if (y < 4 || y > h - 3 || y > 26) return false;
  const tunnel = Math.sin((x + currentWorld.seed) * 0.12) + Math.cos((z - currentWorld.seed) * 0.14) + Math.sin(y * 0.46);
  return tunnel > 2.46 && noise(currentWorld.seed + 440 + y, x, z) > 0.54;
}

function caveEntranceAt(x, y, z) {
  const h = terrainTopAt(x, z);
  if (y < h - 2 || y > h) return false;
  const rare = hash(currentWorld.seed + 770, Math.floor(x / 2), Math.floor(z / 2));
  const throat = Math.abs(Math.sin((x + currentWorld.seed) * 0.21) + Math.cos((z - currentWorld.seed) * 0.19));
  return rare > 0.925 && throat < 0.24;
}

function generatedBlock(x, y, z) {
  const rawH = heightAt(x, z);
  const hasRiver = riverAt(x, z);
  const h = hasRiver ? Math.min(rawH, WATER_LEVEL - 1) : rawH;
  const biome = BIOMES[biomeAt(x, z)];
  const ravine = ravineInfo(x, z);
  if (y < WORLD_BOTTOM) return 'smooth_stone';
  if (ravine.active && y > Math.max(2, h - ravine.depth) && y < h - 1) {
    if (y <= 4) return 'lava';
    if (y <= WATER_LEVEL - 6 && hash(currentWorld.seed + 622, x, z) > 0.55) return 'water';
    return null;
  }
  if (caveAt(x, y, z) || caveEntranceAt(x, y, z)) {
    if (y <= 4) return 'lava';
    if (y <= 8 && hash(currentWorld.seed + 580, x, z) > 0.7) return 'water';
    return null;
  }
  if (y > h) {
    if ((rawH < WATER_LEVEL - 1 || hasRiver) && y <= WATER_LEVEL) return 'water';
    return null;
  }
  if (y === h) return h < WATER_LEVEL || hasRiver ? 'sand' : biome.top;
  if (y >= h - 3) return biome.top === 'sand' ? 'sand' : 'dirt';
  if (y < 3 && hash(currentWorld.seed + 9, x, z) > 0.985) return 'lava';
  if (y < 7 && hash(currentWorld.seed + 20, x + y, z) > 0.97) return 'coal_block';
  if (y < 10 && hash(currentWorld.seed + 25, x - y, z) > 0.986) return 'iron_block';
  if (y < 6 && hash(currentWorld.seed + 30, x, z + y) > 0.994) return 'diamond_block';
  return y > h - 7 ? 'stone' : 'smooth_stone';
}

function overrideFor(x, y, z) {
  return currentWorld.overrides[key(x, y, z)];
}

function blockAt(x, y, z) {
  const override = overrideFor(x, y, z);
  if (override === null) return null;
  if (override) return override;
  return generatedBlock(x, y, z);
}

function isSurfaceVisible(x, y, z) {
  return !blockAt(x, y + 1, z) || !blockAt(x + 1, y, z) || !blockAt(x - 1, y, z) || !blockAt(x, y, z + 1) || !blockAt(x, y, z - 1);
}

function canGrowTree(x, y, z) {
  const ground = blockAt(x, y - 1, z);
  if (ground !== 'grass' && ground !== 'dirt' && ground !== 'wool') return false;
  if (terrainTopAt(x, z) <= WATER_LEVEL + 1 || ravineAt(x, z) || riverAt(x, z)) return false;
  for (let ox = -2; ox <= 2; ox += 1) {
    for (let oz = -2; oz <= 2; oz += 1) {
      if (blockAt(x + ox, y, z + oz) === 'water' || terrainTopAt(x + ox, z + oz) < WATER_LEVEL) return false;
    }
  }
  return true;
}

function addMesh(x, y, z, type, group) {
  const def = blockDef(type);
  if (!def) return null;
  const mesh = new THREE.Mesh(blockGeo, materialFor(def));
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.castShadow = Boolean(def.solid);
  mesh.receiveShadow = true;
  mesh.userData = { x, y, z, type };
  group.add(mesh);
  blockMeshes.push(mesh);
  loadedBlocks.set(key(x, y, z), mesh);
  if (def.light) addLightIfNeeded(x, y, z, type);
  addBlockCollider(x, y, z, type);
  return mesh;
}

function addLightIfNeeded(x, y, z, type) {
  const def = blockDef(type);
  if (!def?.light) return;
  const k = key(x, y, z);
  if (lightSources.has(k)) return;
  const point = new THREE.PointLight(def.emissive || def.color, 1.4, 11, 2);
  point.position.set(x + 0.5, y + 0.6, z + 0.5);
  scene.add(point);
  lightSources.set(k, point);
}

function removeLightIfAny(x, y, z) {
  const k = key(x, y, z);
  const point = lightSources.get(k);
  if (!point) return;
  scene.remove(point);
  lightSources.delete(k);
}

function addPlant(x, y, z, group, color = 0x5e9f46, recorder) {
  const matKey = `plant-${color}`;
  if (!materials.has(matKey)) {
    materials.set(matKey, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
  }
  const a = new THREE.Mesh(tallGeo, materials.get(matKey));
  const b = new THREE.Mesh(tallGeo, materials.get(matKey));
  a.position.set(x + 0.5, y + 0.65, z + 0.5);
  b.position.copy(a.position);
  a.rotation.y = Math.PI / 4;
  b.rotation.y = -Math.PI / 4;
  group.add(a, b);
  if (recorder) recorder.push([x, y, z, color]);
}

function generateTree(x, y, z, group) {
  const h = 4 + Math.floor(hash(currentWorld.seed + 55, x, z) * 3);
  for (let i = 0; i < h; i += 1) addMesh(x, y + i, z, 'wood', group);
  for (let ox = -2; ox <= 2; ox += 1) {
    for (let oz = -2; oz <= 2; oz += 1) {
      for (let oy = h - 2; oy <= h; oy += 1) {
        if (Math.abs(ox) + Math.abs(oz) + Math.max(0, oy - h + 1) < 4) {
          addMesh(x + ox, y + oy, z + oz, 'leaf', group);
        }
      }
    }
  }
}

function generateFallenLog(x, y, z, group) {
  const len = 2 + Math.floor(hash(currentWorld.seed + 88, x, z) * 3);
  const alongX = hash(currentWorld.seed + 89, x, z) > 0.5;
  for (let i = 0; i < len; i += 1) {
    addMesh(x + (alongX ? i : 0), y, z + (alongX ? 0 : i), 'wood', group);
  }
}

function chunkCacheKey(cx, cz) {
  return `${CHUNK_CACHE_VERSION}|${currentWorld.seed}|${cx}|${cz}`;
}

function readChunkCache(cx, cz) {
  try {
    const raw = localStorage.getItem(chunkCacheKey(cx, cz));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeChunkCache(cx, cz, data) {
  try {
    localStorage.setItem(chunkCacheKey(cx, cz), JSON.stringify(data));
  } catch {}
}

function applyChunkOverrides(cx, cz) {
  const minX = cx * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE - 1;
  const minZ = cz * CHUNK_SIZE;
  const maxZ = minZ + CHUNK_SIZE - 1;
  for (const k in currentWorld.overrides) {
    const parts = k.split('|');
    const ox = Number(parts[0]);
    const oz = Number(parts[2]);
    if (ox >= minX && ox <= maxX && oz >= minZ && oz <= maxZ) {
      setBlock(ox, Number(parts[1]), oz, currentWorld.overrides[k], true);
    }
  }
}

function loadChunk(cx, cz) {
  const ck = chunkKey(cx, cz);
  if (chunks.has(ck)) return;
  const group = new THREE.Group();
  group.userData = { cx, cz };

  const cached = readChunkCache(cx, cz);
  if (cached) {
    for (const entry of cached.blocks) addMesh(entry[1], entry[2], entry[3], entry[0], group);
    for (const entry of cached.plants || []) addPlant(entry[0], entry[1], entry[2], group, entry[3]);
    chunks.set(ck, group);
    worldGroup.add(group);
    applyChunkOverrides(cx, cz);
    return;
  }

  const beforeCount = blockMeshes.length;
  const plants = [];
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
    for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
      const x = minX + lx;
      const z = minZ + lz;
      const h = terrainTopAt(x, z);
      const start = ravineAt(x, z) ? Math.max(WORLD_BOTTOM, h - 28) : Math.max(WORLD_BOTTOM, h - 14);
      for (let y = start; y <= Math.max(h, 15); y += 1) {
        const type = blockAt(x, y, z);
        if (type && isSurfaceVisible(x, y, z)) addMesh(x, y, z, type, group);
      }
      const biome = BIOMES[biomeAt(x, z)];
      const top = blockAt(x, h, z);
      const r = hash(currentWorld.seed + 72, x, z);
      if (top && canGrowTree(x, h + 1, z) && r < biome.treeChance) generateTree(x, h + 1, z, group);
      if (top === 'grass' && r > 0.72 && r < 0.72 + biome.grassChance) addPlant(x, h + 1, z, group, biome.tint, plants);
      if (top && biome.fallenLogChance && r > 0.4 && r < 0.4 + biome.fallenLogChance && terrainTopAt(x, z) > WATER_LEVEL) generateFallenLog(x, h + 1, z, group);
    }
  }

  const added = blockMeshes.slice(beforeCount);
  const blocks = added.map((m) => [m.userData.type, m.userData.x, m.userData.y, m.userData.z]);
  writeChunkCache(cx, cz, { blocks, plants });
  chunks.set(ck, group);
  worldGroup.add(group);
}

function unloadChunk(ck) {
  const group = chunks.get(ck);
  if (!group) return;
  group.traverse((obj) => {
    if (obj.isMesh && obj.userData?.type) {
      loadedBlocks.delete(key(obj.userData.x, obj.userData.y, obj.userData.z));
      removeLightIfAny(obj.userData.x, obj.userData.y, obj.userData.z);
      removeBlockCollider(obj.userData.x, obj.userData.y, obj.userData.z);
      const index = blockMeshes.indexOf(obj);
      if (index >= 0) blockMeshes.splice(index, 1);
    }
  });
  worldGroup.remove(group);
  chunks.delete(ck);
}

function loadRadius() {
  return Math.max(1, Math.min(4, Number(settings.renderDistance) || 2));
}

function unloadRadius() {
  return loadRadius() + 1;
}

function updateChunks() {
  if (!currentWorld) return;
  const pcx = floorChunk(player.position.x);
  const pcz = floorChunk(player.position.z);
  const r = loadRadius();
  for (let dx = -r; dx <= r; dx += 1) {
    for (let dz = -r; dz <= r; dz += 1) {
      loadChunk(pcx + dx, pcz + dz);
    }
  }
  const ur = unloadRadius();
  for (const [ck, group] of chunks) {
    const dist = Math.max(Math.abs(group.userData.cx - pcx), Math.abs(group.userData.cz - pcz));
    if (dist > ur) unloadChunk(ck);
  }
}

function setBlock(x, y, z, type, skipPhysics) {
  const k = key(x, y, z);
  const old = loadedBlocks.get(k);
  if (old) {
    old.parent.remove(old);
    loadedBlocks.delete(k);
    const index = blockMeshes.indexOf(old);
    if (index >= 0) blockMeshes.splice(index, 1);
  }
  removeBlockCollider(x, y, z);
  removeLightIfAny(x, y, z);
  currentWorld.overrides[k] = type;  if (type) {
    const cx = floorChunk(x);
    const cz = floorChunk(z);
    const group = chunks.get(chunkKey(cx, cz));
    if (group) addMesh(x, y, z, type, group);
  }
  refreshExposedNeighbors(x, y, z);
  if (!skipPhysics) applyFallingPhysics(x, y, z, type);
}

function fallTargetY(x, y, z) {
  let ny = y;
  while (ny > WORLD_BOTTOM + 1 && !isSolidAt(x, ny - 1, z)) ny -= 1;
  return ny;
}

function applyFallingPhysics(x, y, z, changedType) {
  if ((changedType === 'sand' || changedType === 'gravel') && !isSolidAt(x, y - 1, z)) {
    const ny = fallTargetY(x, y, z);
    if (ny !== y) {
      setBlock(x, y, z, null, true);
      setBlock(x, ny, z, changedType);
    }
    return;
  }
  const above = blockAt(x, y + 1, z);
  if ((above === 'sand' || above === 'gravel') && !isSolidAt(x, y, z)) {
    const ny = fallTargetY(x, y, z);
    if (ny !== y + 1) {
      setBlock(x, y + 1, z, null, true);
      setBlock(x, ny, z, above);
    }
  }
}

function chunkGroupForBlock(x, z) {
  return chunks.get(chunkKey(floorChunk(x), floorChunk(z)));
}

function refreshBlockMesh(x, y, z) {
  const k = key(x, y, z);
  const old = loadedBlocks.get(k);
  const type = blockAt(x, y, z);
  const visible = Boolean(type && isSurfaceVisible(x, y, z));
  if (old && (!visible || old.userData.type !== type)) {
    old.parent?.remove(old);
    loadedBlocks.delete(k);
    removeLightIfAny(x, y, z);
    removeBlockCollider(x, y, z);
    const index = blockMeshes.indexOf(old);
    if (index >= 0) blockMeshes.splice(index, 1);
  }
  if (!loadedBlocks.has(k) && visible) {
    const group = chunkGroupForBlock(x, z);
    if (group) addMesh(x, y, z, type, group);
  }
}

function refreshExposedNeighbors(x, y, z) {
  const points = [
    [x, y, z],
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x, y, z + 1],
    [x, y, z - 1]
  ];
  for (const point of points) refreshBlockMesh(point[0], point[1], point[2]);
}

function createDrop(x, y, z, type) {
  const def = blockDef(type);
  if (!def) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), materialFor(def));
  mesh.position.set(x + 0.5, y + 0.72, z + 0.5);
  mesh.castShadow = true;
  dropGroup.add(mesh);
  drops.push({
    mesh,
    type,
    velocity: new THREE.Vector3((Math.random() - 0.5) * 1.8, 2.2, (Math.random() - 0.5) * 1.8),
    age: 0
  });
}

function findTarget() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  return raycaster.intersectObjects(blockMeshes, false).find((hit) => hit.distance < 7) || null;
}

function interact(place) {
  if (!running || !currentWorld || !el.inventoryPanel.classList.contains('hidden')) return;

  const hit = findTarget();
  if (!hit) return;
  const data = hit.object.userData;
  if (!place) {
    createDrop(data.x, data.y, data.z, data.type);
    setBlock(data.x, data.y, data.z, null);
    return;
  }
  if (!blockDef(selectedItem)?.solid && selectedItem !== 'water' && selectedItem !== 'lava' && selectedItem !== 'torch') return;
  if (currentWorld.mode === 'survival' && !consumeInventory(selectedItem, 1)) return;
  const p = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.51));
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  const z = Math.floor(p.z);
  if (Math.abs(player.position.x - (x + 0.5)) < 0.75 && Math.abs(player.position.z - (z + 0.5)) < 0.75 && Math.abs(player.position.y - (y + 0.5)) < 2) return;
  setBlock(x, y, z, selectedItem);
}

function isSolidAt(x, y, z) {
  const type = blockAt(Math.floor(x), Math.floor(y), Math.floor(z));
  const def = blockDef(type);
  return Boolean(def?.solid);
}

function autoJumpNeeded(move) {
  if (!settings.autoJump || move.lengthSq() === 0) return false;
  const dir = move.clone().normalize();
  const footY = Math.floor(player.position.y - PLAYER_HEIGHT);
  const fx = Math.floor(player.position.x + dir.x * 0.7);
  const fz = Math.floor(player.position.z + dir.z * 0.7);
  return isSolidAt(fx, footY, fz) && !isSolidAt(fx, footY + 1, fz);
}

function liquidAt(x, y, z) {
  const type = blockAt(Math.floor(x), Math.floor(y), Math.floor(z));
  return type === 'water' || type === 'lava' ? type : null;
}

function toggleFreeCam() {
  if (!currentWorld) return;
  player.freeCam = !player.freeCam;
  if (player.freeCam) {
    freeCamState.position.copy(player.position);
    freeCamState.yaw = player.yaw;
    freeCamState.pitch = player.pitch;
    showWorldToast('Camera livre ativada');
  } else {
    showWorldToast('Camera livre desativada');
  }
}

function updateFreeCam(delta) {
  const input = new THREE.Vector3(controls.right, 0, controls.forward);
  if (controls.joystick.lengthSq() > 0) input.set(controls.joystick.x, 0, -controls.joystick.y);
  if (input.lengthSq() > 1) input.normalize();
  const forward = new THREE.Vector3(Math.sin(freeCamState.yaw), 0, Math.cos(freeCamState.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const move = forward.multiplyScalar(input.z).add(right.multiplyScalar(input.x));
  const speed = 15;
  freeCamState.position.addScaledVector(move, speed * delta);
  if (controls.jump) freeCamState.position.y += speed * delta;
  if (controls.descend) freeCamState.position.y -= speed * delta;
  freeCamState.yaw -= controls.lookDX * 0.0022;
  freeCamState.pitch -= controls.lookDY * 0.0022;
  freeCamState.pitch = THREE.MathUtils.clamp(freeCamState.pitch, -1.5, 1.5);
  controls.lookDX = 0;
  controls.lookDY = 0;
  camera.position.copy(freeCamState.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = freeCamState.yaw;
  camera.rotation.x = freeCamState.pitch;
}

function stepPlayerPhysics(delta, fallbackNext) {
  if (!rapierReady || !characterController || !playerCollider || !playerBody) {
    const footY = fallbackNext.y - PLAYER_HEIGHT;
    if (isSolidAt(fallbackNext.x, footY, fallbackNext.z)) {
      fallbackNext.y = Math.floor(footY) + PLAYER_HEIGHT + 1;
      player.velocity.y = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }
    if (isSolidAt(fallbackNext.x, fallbackNext.y - 0.25, fallbackNext.z)) {
      fallbackNext.x = player.position.x;
      fallbackNext.z = player.position.z;
    }
    if (fallbackNext.y < -12) damagePlayer(999);
    player.position.copy(fallbackNext);
    return;
  }
  const desired = { x: player.velocity.x * delta, y: player.velocity.y * delta, z: player.velocity.z * delta };
  characterController.computeColliderMovement(playerCollider, desired);
  const corrected = characterController.computedMovement();
  player.onGround = characterController.computedGrounded();
  const t = playerBody.translation();
  const nx = t.x + corrected.x;
  const ny = t.y + corrected.y;
  const nz = t.z + corrected.z;
  playerBody.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
  physicsWorld.step();
  if (player.onGround && player.velocity.y < 0) player.velocity.y = 0;
  player.position.set(nx, ny + PLAYER_HEIGHT / 2, nz);
  if (player.position.y < -12) damagePlayer(999);
}

function updatePlayer(delta) {
  if (player.freeCam) {
    updateFreeCam(delta);
    updatePlayerAvatar();
    return;
  }
  const input = new THREE.Vector3(controls.right, 0, controls.forward);
  if (controls.joystick.lengthSq() > 0) input.set(controls.joystick.x, 0, -controls.joystick.y);
  if (input.lengthSq() > 1) input.normalize();

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const move = forward.multiplyScalar(input.z).add(right.multiplyScalar(input.x));
  const creative = currentWorld.mode === 'creative';
  const inLiquid = liquidAt(player.position.x, player.position.y - 0.8, player.position.z);
  const flying = creative && player.flyMode;
  const speed = inLiquid ? 2.6 : creative ? 8.2 : 5.2;
  player.velocity.x = move.x * speed;
  player.velocity.z = move.z * speed;

  if (flying) {
    player.velocity.y *= 0.82;
    if (controls.jump) player.velocity.y = 6.5;
  } else if (inLiquid) {
    player.velocity.y = Math.max(player.velocity.y - 4 * delta, -2.4);
    if (controls.jump) player.velocity.y = 3.3;
  } else if ((controls.jump || autoJumpNeeded(move)) && player.onGround) {
    player.velocity.y = creative ? 8.4 : 8;
    player.onGround = false;
  }

  if (!flying && !inLiquid) player.velocity.y -= 23 * delta;
  if (creative && !flying) player.velocity.y *= 0.98;
  if (inLiquid) {
    player.velocity.x *= 0.78;
    player.velocity.z *= 0.78;
    if (inLiquid === 'lava') damagePlayer(delta * 18);
  }

  const next = player.position.clone().addScaledVector(player.velocity, delta);
  stepPlayerPhysics(delta, next);
  player.yaw -= controls.lookDX * 0.0022;
  player.pitch -= controls.lookDY * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.48, 1.48);
  controls.lookDX = 0;
  controls.lookDY = 0;
  camera.position.copy(player.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  updatePlayerAvatar();
  if (currentWorld.mode === 'survival') {
    const headSubmerged = liquidAt(player.position.x, player.position.y - 0.15, player.position.z) === 'water';
    if (headSubmerged) {
      player.oxygen = Math.max(0, player.oxygen - delta * 6.5);
      if (player.oxygen <= 0) damagePlayer(delta * 10);
    } else {
      player.oxygen = Math.min(100, player.oxygen + delta * 30);
    }
  }
}

function updatePlayerAvatar() {
  const back = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-0.34);
  playerAvatar.position.set(player.position.x + back.x, player.position.y - 0.72, player.position.z + back.z);
  playerAvatar.rotation.y = player.yaw + Math.PI;
  playerAvatar.visible = player.freeCam;
  const head = playerAvatar.getObjectByName('head');
  if (head) head.rotation.x = player.pitch * 0.25;
}

function updateDrops(delta) {
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    drop.age += delta;
    const toPlayer = player.position.clone().sub(drop.mesh.position);
    const distance = toPlayer.length();
    if (distance < 3.2) {
      drop.velocity.addScaledVector(toPlayer.normalize(), delta * 9);
    }
    drop.velocity.y -= 12 * delta;
    const next = drop.mesh.position.clone().addScaledVector(drop.velocity, delta);
    if (isSolidAt(next.x, next.y - 0.22, next.z)) {
      next.y = Math.floor(next.y - 0.22) + 1.22;
      drop.velocity.multiplyScalar(0.35);
      drop.velocity.y = 0;
    }
    drop.mesh.position.copy(next);
    drop.mesh.rotation.x += delta * 2;
    drop.mesh.rotation.y += delta * 3;
    if (drop.mesh.position.distanceTo(player.position) < 2.05) {
      addInventory(drop.type, 1);
      dropGroup.remove(drop.mesh);
      drops.splice(i, 1);
    } else if (drop.age > 45) {
      dropGroup.remove(drop.mesh);
      drops.splice(i, 1);
    }
  }
}

function damagePlayer(amount) {
  if (!currentWorld || currentWorld.mode === 'creative') return;
  player.health = Math.max(0, player.health - amount);
  if (player.health <= 0) {
    running = false;
    el.deathPanel.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function updateSky(delta) {
  timeOfDay = (timeOfDay + delta * 0.0008) % 1;
  const angle = timeOfDay * Math.PI * 2;
  const light = Math.max(0.08, Math.sin(angle) * 0.5 + 0.5);
  scene.background = new THREE.Color().setHSL(0.57, 0.55, 0.16 + light * 0.55);
  scene.fog = new THREE.Fog(scene.background, 34, 130);
  hemi.intensity = 0.25 + light * 0.9;
  sun.intensity = 0.16 + light * 1.3;
  sunMesh.position.set(Math.cos(angle) * 55, Math.sin(angle) * 55 + 18, -18);
  moonMesh.position.set(Math.cos(angle + Math.PI) * 55, Math.sin(angle + Math.PI) * 55 + 18, -18);
  sun.position.copy(sunMesh.position);
  const phase = light > 0.62 ? 'Dia' : light > 0.25 ? 'Entardecer' : 'Noite';
  el.clock.textContent = `${phase} | ${weather.kind === 'clear' ? 'ceu limpo' : weather.kind}`;
}

function rebuildWeather() {
  // Dispose geometries/materials to avoid memory leaks
  weatherGroup.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
  });
  // Material is shared, so dispose only once (if it exists)
  if (weatherGroup.children.length > 0 && weatherGroup.children[0].material) {
    weatherGroup.children[0].material.dispose();
  }

  weatherGroup.clear();

  if (weather.kind === 'clear') return;

  const isSnow = weather.kind === 'neve';
  const color = isSnow ? 0xffffff : 0x9cc8ef;
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
  });

  const len = isSnow ? 0.12 : 0.55;

  for (let i = 0; i < 240; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -len, 0),
    ]);

    const drop = new THREE.Line(geo, material);
    drop.position.set(
      (Math.random() - 0.5) * 70,
      8 + Math.random() * 25,
      (Math.random() - 0.5) * 70
    );

    weatherGroup.add(drop);
  }
}

function updateWeather(delta) {
  weather.timer -= delta;
  if (weather.timer <= 0) {
    const biome = biomeAt(Math.floor(player.position.x), Math.floor(player.position.z));
    const roll = Math.random();
    weather.kind = roll < 0.62 ? 'clear' : biome === 'snow' ? 'neve' : 'chuva';
    weather.timer = weather.kind === 'clear' ? 28 + Math.random() * 32 : 18 + Math.random() * 24;
    rebuildWeather();
  }
  for (const drop of weatherGroup.children) {
    drop.position.y -= delta * (weather.kind === 'neve' ? 2.2 : 13);
    drop.position.x += delta * 0.8;
    drop.position.z += delta * 0.25;
    if (drop.position.y < 1) {
      drop.position.set(player.position.x + (Math.random() - 0.5) * 70, player.position.y + 8 + Math.random() * 25, player.position.z + (Math.random() - 0.5) * 70);
    }
  }
}

function createClouds() {
  cloudGroup.clear();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2f5f2, transparent: true, opacity: 0.82 });
  for (let i = 0; i < 24; i += 1) {
    const group = new THREE.Group();
    for (let p = 0; p < 4; p += 1) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(5 + p, 1.1, 3 + (p % 2)), mat);
      mesh.position.set(p * 2.6, 0, (p % 2) * 1.6);
      group.add(mesh);
    }
    group.position.set((Math.random() - 0.5) * 160, 44 + Math.random() * 16, (Math.random() - 0.5) * 160);
    cloudGroup.add(group);
  }
}

function updateClouds(delta) {
  for (const c of cloudGroup.children) {
    c.position.x += delta * 1.15;
    if (c.position.x - player.position.x > 95) c.position.x = player.position.x - 95;
  }
}

function loadSettings() {
  try {
    return { fps: 60, renderDistance: 2, username: 'Jogador', autoJump: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { fps: 60, renderDistance: 2, username: 'Jogador', autoJump: false };
  }
}

function saveSettings() {
  settings = {
    fps: Number(el.fps.value),
    renderDistance: Number(el.renderDistance.value),
    username: el.username.value.trim() || 'Jogador',
    autoJump: el.autoJump.checked
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadWorlds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveWorlds() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(worlds));
}

function loadMods() {
  try {
    return JSON.parse(localStorage.getItem(MOD_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveMods() {
  localStorage.setItem(MOD_STORAGE_KEY, JSON.stringify(mods));
}

function createWorld(name, mode) {
  const cleanName = name || `Mundo ${worlds.length + 1}`;
  const seed = worldSeed(`${cleanName}-${Date.now()}`);
  let spawnX = 0;
  let spawnZ = 0;
  let spawnH = heightAtWithSeed(seed, 0, 0);
  if (spawnH < WATER_LEVEL + 1) {
    for (let r = 4; r <= 80 && spawnH < WATER_LEVEL + 1; r += 4) {
      for (let a = 0; a < 8 && spawnH < WATER_LEVEL + 1; a += 1) {
        const tx = Math.round(Math.cos((a / 8) * Math.PI * 2) * r);
        const tz = Math.round(Math.sin((a / 8) * Math.PI * 2) * r);
        const th = heightAtWithSeed(seed, tx, tz);
        if (th >= WATER_LEVEL + 1) { spawnX = tx; spawnZ = tz; spawnH = th; }
      }
    }
  }
  const spawnY = spawnH + PLAYER_HEIGHT + 2;
  const world = {
    id: `world-${Date.now()}`,
    name: cleanName,
    mode,
    seed,
    createdAt: new Date().toISOString(),
    overrides: {},
    inventory: mode === 'survival' ? { wood: 2 } : {},
    player: { x: spawnX, y: spawnY, z: spawnZ, yaw: 0, pitch: -0.18, health: 100 }
  };
  worlds.unshift(world);
  selectedWorldId = world.id;
  saveWorlds();
  renderWorlds();
  return world;
}

function heightAtWithSeed(seed, x, z) {
  const previous = currentWorld;
  currentWorld = { seed };
  const h = terrainTopAt(x, z);
  currentWorld = previous;
  return h;
}

function openEditWorldModal(worldId) {
  const world = worlds.find((item) => item.id === worldId);
  if (!world) return;
  editingWorldId = worldId;
  el.editWorldName.value = world.name;
  el.editGameMode.value = world.mode;
  el.editWorldPanel.classList.remove('hidden');
}

function saveEditedWorld() {
  if (!editingWorldId) return;
  const world = worlds.find((item) => item.id === editingWorldId);
  if (world) {
    world.name = el.editWorldName.value.trim() || world.name;
    world.mode = el.editGameMode.value;
    saveWorlds();
    renderWorlds();
  }
  el.editWorldPanel.classList.add('hidden');
  editingWorldId = null;
}

function persistCurrentWorld() {
  if (!currentWorld) return;
  currentWorld.player = {
    x: Number(player.position.x.toFixed(2)),
    y: Number(player.position.y.toFixed(2)),
    z: Number(player.position.z.toFixed(2)),
    yaw: player.yaw,
    pitch: player.pitch,
    health: player.health
  };
  const index = worlds.findIndex((world) => world.id === currentWorld.id);
  if (index >= 0) worlds[index] = currentWorld;
  saveWorlds();
}

function deleteWorld(id) {
  if (!confirm('Apagar este mundo? Esta ação não pode ser desfeita.')) return;
  worlds = worlds.filter((w) => w.id !== id);
  saveWorlds();
  if (selectedWorldId === id) selectedWorldId = worlds[0]?.id ?? null;
  renderWorlds();
}

function renderWorlds() {
  el.worldList.innerHTML = '';
  el.downloadWorld.disabled = !selectedWorldId;
  if (!worlds.length) {
    el.worldList.innerHTML = '<p>Nenhum mundo criado.</p>';
    return;
  }
  for (const world of worlds) {
    const row = document.createElement('div');
    row.className = `world-row${world.id === selectedWorldId ? ' selected' : ''}`;
    const meta = document.createElement('div');
    meta.innerHTML = `<strong>${world.name}</strong><small>${world.mode === 'creative' ? 'Criativo' : 'Sobrevivência'} | seed ${world.seed}</small>`;
    const actions = document.createElement('div');
    actions.className = 'world-actions';
    
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openEditWorldModal(world.id);
    };

    const del = document.createElement('button');
    del.textContent = 'Apagar';
    del.onclick = (e) => {
      e.stopPropagation();
      deleteWorld(world.id);
    };

    const play = document.createElement('button');
    play.textContent = 'Jogar';
    play.onclick = (e) => {
      e.stopPropagation();
      startWorld(world.id);
    };

    actions.append(editBtn, del, play);
    row.append(meta, actions);
    el.worldList.append(row);
  }
}

function clearLoadedWorld() {
  worldGroup.clear();
  weatherGroup.clear();
  dropGroup.clear();
  chunks.clear();
  loadedBlocks.clear();
  blockMeshes.length = 0;
  drops.length = 0;
  if (rapierReady) {
    for (const collider of blockColliders.values()) physicsWorld.removeCollider(collider, true);
  }
  blockColliders.clear();
}

function setLoading(progress, text) {
  el.loadingFill.style.width = `${Math.round(progress * 100)}%`;
  el.loadingLabel.textContent = text;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function preloadInitialChunks() {
  const pcx = floorChunk(player.position.x);
  const pcz = floorChunk(player.position.z);
  const coords = [];
  const r = loadRadius();
  for (let dx = -r; dx <= r; dx += 1) {
    for (let dz = -r; dz <= r; dz += 1) {
      coords.push([pcx + dx, pcz + dz]);
    }
  }
  coords.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcz) - Math.hypot(b[0] - pcx, b[1] - pcz));
  for (let i = 0; i < coords.length; i += 1) {
    loadChunk(coords[i][0], coords[i][1]);
    setLoading((i + 1) / coords.length, `Gerando pedaco ${i + 1}/${coords.length}`);
    if (i % 2 === 1) await nextFrame();
  }
}

async function startWorld(id) {
  const world = worlds.find((item) => item.id === id);
  if (!world) return;
  saveSettings();
  currentWorld = structuredClone(world);
  selectedWorldId = id;
  clearLoadedWorld();
  player.position.set(currentWorld.player.x, currentWorld.player.y, currentWorld.player.z);
  player.velocity.set(0, 0, 0);
  player.yaw = currentWorld.player.yaw ?? 0;
  player.pitch = currentWorld.player.pitch ?? -0.18;
  player.flyMode = false;
  player.freeCam = false;
  player.oxygen = 100;
  player.health = currentWorld.mode === 'creative' ? Infinity : currentWorld.player.health ?? 100;
  timeOfDay = 0.22;
  el.home.classList.remove('active');
  el.game.classList.add('active');
  el.inventoryPanel.classList.add('hidden');
  el.pausePanel.classList.add('hidden');
  el.loadingPanel.classList.remove('hidden');
  el.deathPanel.classList.add('hidden');
  el.topWorld.textContent = `${currentWorld.name} | ${currentWorld.mode === 'creative' ? 'Criativo' : 'Sobrevivência'}`;
  running = false;
  setLoading(0, 'Iniciando motor de fisica...');
  await physicsReadyPromise;
  syncPlayerBodyToPosition();
  setLoading(0.04, 'Preparando seed e biomas...');
  buildPlayerAvatar();
  await nextFrame();
  await preloadInitialChunks();
  createClouds();
  HOTBAR = [...DEFAULT_HOTBAR];
  selectedItem = HOTBAR[0];
  renderHotbar();
  updateHud();
  el.loadingPanel.classList.add('hidden');
  running = true;

  const currentUsername = resolveUsernameConflict(settings.username || 'Jogador', activePlayers);
  if (!activePlayers.includes(currentUsername)) {
    activePlayers.push(currentUsername);
  }
  showWorldToast(`${currentUsername} entrou no mundo!`);

  if (isOnlineActive) {
    el.onlineTag.classList.remove('hidden');
  } else {
    el.onlineTag.classList.add('hidden');
  }
}

function exitToHome() {
  const currentUsername = settings.username || 'Jogador';
  showWorldToast(`${currentUsername} saiu do mundo!`);
  persistCurrentWorld();
  running = false;
  if (document.pointerLockElement) document.exitPointerLock();
  clearLoadedWorld();
  el.game.classList.remove('active');
  el.home.classList.add('active');
  renderWorlds();
}

function updateHud() {
  if (currentWorld?.mode === 'creative') {
    el.health.textContent = player.flyMode ? 'Vida infinita | voo' : 'Vida infinita';
    el.oxygen.classList.add('hidden');
  } else {
    el.health.textContent = `Vida ${Math.ceil(player.health)}/100`;
    const submerged = player.oxygen < 100;
    el.oxygen.classList.toggle('hidden', !submerged);
    el.oxygen.textContent = `Oxigenio ${Math.ceil(player.oxygen)}/100`;
  }
}

function itemName(id) {
  return ITEMS.find((item) => item.id === id)?.name || id;
}

function renderHotbar() {
  el.hotbar.innerHTML = '';
  HOTBAR.forEach((id, index) => {
    const def = blockDef(id);
    const button = document.createElement('button');
    button.className = `slot${selectedItem === id ? ' active' : ''}`;
    button.style.background = `#${def.color.toString(16).padStart(6, '0')}`;
    button.textContent = `${index + 1} ${def.name}`;
    button.onclick = () => selectItem(id);
    el.hotbar.append(button);
  });
}

function selectItem(id) {
  selectedItem = id;
  renderHotbar();
}

function pickFromInventory(id) {
  if (!HOTBAR.includes(id)) {
    const slot = HOTBAR.indexOf(selectedItem);
    HOTBAR[slot >= 0 ? slot : 0] = id;
  }
  selectItem(id);
}

function renderInventory() {
  const creative = currentWorld?.mode === 'creative';
  el.inventoryTitle.textContent = creative ? 'Menu criativo' : 'Inventario';
  el.creativeList.classList.toggle('hidden', !creative);
  el.survivalInventory.classList.toggle('hidden', creative);
  el.craftingBox.classList.toggle('hidden', creative);
  if (creative) renderCreativeList();
  else renderSurvivalInventory();
}

function renderCreativeList() {
  const query = el.blockSearch.value.trim().toLowerCase();
  el.creativeList.innerHTML = '';
  for (const item of ITEMS.filter((entry) => entry.name.toLowerCase().includes(query))) {
    const button = document.createElement('button');
    button.className = 'item';
    button.style.background = `#${item.color.toString(16).padStart(6, '0')}`;
    button.textContent = item.name;
    button.onclick = () => {
      pickFromInventory(item.id);
      el.inventoryPanel.classList.add('hidden');
    };
    el.creativeList.append(button);
  }
}

function renderSurvivalInventory() {
  el.survivalInventory.innerHTML = '';
  const entries = Object.entries(currentWorld.inventory || {});
  if (!entries.length) {
    el.survivalInventory.innerHTML = '<p>Inventario vazio.</p>';
    return;
  }
  for (const [id, qty] of entries) {
    const slot = document.createElement('button');
    slot.className = 'survival-slot';
    slot.textContent = `${itemName(id)}\n${qty}`;
    slot.onclick = () => pickFromInventory(id);
    el.survivalInventory.append(slot);
  }
}

function addInventory(id, qty) {
  if (currentWorld.mode !== 'survival') return;
  currentWorld.inventory[id] = (currentWorld.inventory[id] || 0) + qty;
}

function consumeInventory(id, qty) {
  if (currentWorld.mode !== 'survival') return true;
  if ((currentWorld.inventory[id] || 0) < qty) return false;
  currentWorld.inventory[id] -= qty;
  if (currentWorld.inventory[id] <= 0) delete currentWorld.inventory[id];
  return true;
}

function craft(recipe) {
  if (recipe === 'sticks') {
    if (!consumeInventory('wood', 1)) return showCraft('Precisa de madeira.');
    addInventory('stick', 4);
    showCraft('Gravetos criados.');
  }
  if (recipe === 'sword') {
    if ((currentWorld.inventory.stick || 0) < 1 || (currentWorld.inventory.wood || 0) < 1) return showCraft('Precisa de graveto e madeira.');
    consumeInventory('stick', 1);
    consumeInventory('wood', 1);
    addInventory('sword', 1);
    showCraft('Espada criada.');
  }
  if (recipe === 'torch') {
    if ((currentWorld.inventory.stick || 0) < 1 || (currentWorld.inventory.coal_block || 0) < 1) return showCraft('Precisa de graveto e carvao.');
    consumeInventory('stick', 1);
    consumeInventory('coal_block', 1);
    addInventory('torch', 4);
    showCraft('Tochas criadas.');
  }
  if (recipe === 'pickaxe') {
    if ((currentWorld.inventory.stick || 0) < 2 || (currentWorld.inventory.stone || 0) < 3) return showCraft('Precisa de 2 gravetos e 3 pedras.');
    consumeInventory('stick', 2);
    consumeInventory('stone', 3);
    addInventory('pickaxe', 1);
    showCraft('Picareta criada.');
  }
  if (recipe === 'axe') {
    if ((currentWorld.inventory.stick || 0) < 2 || (currentWorld.inventory.wood || 0) < 3) return showCraft('Precisa de 2 gravetos e 3 madeiras.');
    consumeInventory('stick', 2);
    consumeInventory('wood', 3);
    addInventory('axe', 1);
    showCraft('Machado criado.');
  }
  if (recipe === 'shovel') {
    if ((currentWorld.inventory.stick || 0) < 2 || (currentWorld.inventory.stone || 0) < 1) return showCraft('Precisa de 2 gravetos e 1 pedra.');
    consumeInventory('stick', 2);
    consumeInventory('stone', 1);
    addInventory('shovel', 1);
    showCraft('Pa criada.');
  }
  if (recipe === 'door') {
    if ((currentWorld.inventory.wood || 0) < 6) return showCraft('Precisa de 6 madeiras.');
    consumeInventory('wood', 6);
    addInventory('door', 2);
    showCraft('Portas criadas.');
  }
  renderSurvivalInventory();
}

function showCraft(text) {
  el.craftingMessage.textContent = text;
}

function openInventory() {
  if (!currentWorld) return;
  renderInventory();
  el.inventoryPanel.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

function toggleChat(force) {
  if (!currentWorld) return;
  chatOpen = force ?? !chatOpen;
  el.chatPanel.classList.toggle('hidden', !chatOpen);
  if (chatOpen) {
    if (document.pointerLockElement) document.exitPointerLock();
    el.chatInput.focus();
  } else {
    el.chatInput.blur();
  }
}

function addChatMessage(author, text) {
  const row = document.createElement('div');
  row.className = 'chat-line';
  const strong = document.createElement('strong');
  strong.textContent = `${author}: `;
  row.append(strong, document.createTextNode(text));
  el.chatMessages.append(row);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function sendChatMessage() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  addChatMessage(settings.username || 'Jogador', text);
  el.chatInput.value = '';
}

function togglePause(force) {
  if (!currentWorld) return;
  const show = force ?? el.pausePanel.classList.contains('hidden');
  el.pausePanel.classList.toggle('hidden', !show);
  running = !show;
  if (show && document.pointerLockElement) document.exitPointerLock();
}

function encodeOnlineCode(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function decodeOnlineCode(code) {
  return JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
}

function waitForIceGathering(peer) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (peer.iceGatheringState === 'complete') {
        peer.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    peer.addEventListener('icegatheringstatechange', done);
    window.setTimeout(resolve, 1400);
  });
}

async function shareCurrentWorld() {
  if (!currentWorld) return;
  persistCurrentWorld();
  isOnlineActive = true;
  el.sharePanel.classList.remove('hidden');
  el.pausePanel.classList.add('hidden');
  el.shareStatus.textContent = 'Gerando codigo WebRTC e ativando modo online.';
  if (document.pointerLockElement) document.exitPointerLock();

  const hostUsername = resolveUsernameConflict(settings.username || 'Jogador', activePlayers);
  if (!activePlayers.includes(hostUsername)) activePlayers.push(hostUsername);

  const world = worlds.find((item) => item.id === currentWorld.id) || currentWorld;
  const payload = {
    type: 'voxel-sandbox-offer',
    version: 1,
    host: hostUsername,
    world: {
      ...world,
      id: `online-${world.id}`,
      name: `${world.name} online`
    },
    offer: null
  };
  if ('RTCPeerConnection' in window) {
    try {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const channel = peer.createDataChannel('voxel-world');
      channel.onopen = () => {
        channel.send(JSON.stringify({ type: 'world', world: payload.world }));
        el.shareStatus.textContent = 'Conexao WebRTC aberta. Modo online ativado!';
      };
      onlineSession = { peer, channel };
      await peer.setLocalDescription(await peer.createOffer());
      await waitForIceGathering(peer);
      payload.offer = peer.localDescription;
    } catch (error) {
      payload.offerError = String(error);
    }
  }
  el.shareCodeOutput.value = encodeOnlineCode(payload);
  el.shareStatus.textContent = payload.offer ? 'Codigo pronto. Envie para o outro jogador. Modo online ativado!' : 'Codigo pronto com dados do mundo; WebRTC nao ficou disponivel neste navegador.';
}

async function testOnlineCode() {
  el.onlineWorldList.innerHTML = '';
  if (!('RTCPeerConnection' in window)) {
    el.onlineStatus.textContent = 'Teste falhou: este navegador nao suporta WebRTC.';
    return null;
  }
  try {
    const payload = decodeOnlineCode(el.onlineCodeInput.value);
    if (payload.type !== 'voxel-sandbox-offer' || !payload.world) throw new Error('codigo invalido');
    el.onlineStatus.textContent = 'Teste de conexao: WebRTC suportado e codigo valido.';
    const testRow = document.createElement('div');
    testRow.className = 'world-row selected';
    testRow.innerHTML = '<div><strong>Teste de conexao</strong><small>OK: navegador e codigo validos</small></div>';
    el.onlineWorldList.append(testRow);
    if (payload.offer) {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peer.ondatachannel = (event) => {
        onlineSession = { peer, channel: event.channel };
      };
      await peer.setRemoteDescription(payload.offer);
      await peer.setLocalDescription(await peer.createAnswer());
      await waitForIceGathering(peer);
      onlineSession = { peer, answer: peer.localDescription };
    }
    return payload;
  } catch {
    el.onlineStatus.textContent = 'Teste falhou: cole um codigo online valido.';
    return null;
  }
}

async function joinOnlineWorld() {
  const payload = await testOnlineCode();
  if (!payload) return;
  isOnlineActive = true;
  const row = document.createElement('div');
  row.className = 'world-row';

  const otherPlayerName = resolveUsernameConflict(payload.host || 'Jogador', activePlayers);
  if (!activePlayers.includes(otherPlayerName)) activePlayers.push(otherPlayerName);

  const meta = document.createElement('div');
  meta.innerHTML = `<strong>${payload.world.name}</strong><small>Host: ${otherPlayerName} | ${payload.world.mode === 'creative' ? 'Criativo' : 'Sobrevivência'}</small>`;
  const actions = document.createElement('div');
  actions.className = 'world-actions';
  const play = document.createElement('button');
  play.textContent = 'Jogar naquele mundo';
  play.onclick = () => {
    const imported = structuredClone(payload.world);
    imported.id = `online-${Date.now()}`;
    imported.createdAt = new Date().toISOString();
    worlds.unshift(imported);
    selectedWorldId = imported.id;
    saveWorlds();
    startWorld(imported.id);
  };
  actions.append(play);
  row.append(meta, actions);
  el.onlineWorldList.append(row);
  el.onlineStatus.textContent = onlineSession?.answer ? 'Mundo encontrado. Resposta WebRTC criada localmente. Modo online ativado!' : 'Mundo encontrado pelo codigo. Modo online ativado!';
}

function downloadSelectedWorld() {
  const world = worlds.find((item) => item.id === selectedWorldId);
  if (!world) return;
  const blob = new Blob([JSON.stringify(world, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${world.name.replace(/\W+/g, '-').toLowerCase() || 'mundo'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderMods() {
  el.modList.innerHTML = '';
  if (!mods.length) {
    el.modList.innerHTML = '<p>Nenhum mod instalado.</p>';
    return;
  }
  mods.forEach((mod, index) => {
    const row = document.createElement('div');
    row.className = 'mod-row';
    const name = document.createElement('strong');
    name.textContent = mod.name;
    const remove = document.createElement('button');
    remove.textContent = 'Tirar';
    remove.onclick = () => {
      mods.splice(index, 1);
      saveMods();
      renderMods();
    };
    row.append(name, remove);
    el.modList.append(row);
  });
}

function applyMods() {
  const api = {
    registerBlock(def) {
      if (!def?.id || !def?.name || !def?.color || blockDef(def.id)) return;
      BLOCKS.push({ solid: true, ...def });
      ITEMS.push({ solid: true, ...def });
    }
  };
  for (const mod of mods) {
    try {
      new Function('api', mod.code)(api);
    } catch (error) {
      console.warn(`Mod ${mod.name} falhou`, error);
    }
  }
}

function exportModTemplate() {
  const template = `api.registerBlock({\n  id: 'meu_bloco',\n  name: 'Meu bloco',\n  color: 0x44aa88,\n  solid: true\n});\n`;
  const blob = new Blob([template], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mod-exemplo.js';
  anchor.click();
  URL.revokeObjectURL(url);
}

function animate(now = 0) {
  requestAnimationFrame(animate);
  const targetFrame = 1000 / Math.max(15, settings.fps || 60);
  if (now - lastFrame < targetFrame) return;
  const delta = Math.min(clock.getDelta() + accumulator, 0.05);
  accumulator = 0;
  lastFrame = now;
  if (running && currentWorld) {
    updatePlayer(delta);
    updateChunks();
    updateSky(delta);
    updateWeather(delta);
    updateClouds(delta);
    updateDrops(delta);
    updateHud();
  }
  if (rendererReady) renderer.render(scene, camera);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setKey(code, pressed) {
  if (code === 'KeyW') controls.forward = pressed ? 1 : controls.forward === 1 ? 0 : controls.forward;
  if (code === 'KeyS') controls.forward = pressed ? -1 : controls.forward === -1 ? 0 : controls.forward;
  if (code === 'KeyA') controls.right = pressed ? -1 : controls.right === -1 ? 0 : controls.right;
  if (code === 'KeyD') controls.right = pressed ? 1 : controls.right === 1 ? 0 : controls.right;
  if (code === 'Space') controls.jump = pressed;
  if (code === 'ShiftLeft' || code === 'ShiftRight') controls.descend = pressed;
}

function updateJoystick(clientX, clientY) {
  const rect = el.joystickZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const max = 48;
  const len = Math.min(max, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * len;
  const y = Math.sin(angle) * len;
  el.joystickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  controls.joystick.set(x / max, y / max);
}

function resetJoystick() {
  el.joystickThumb.style.transform = 'translate(-50%, -50%)';
  controls.joystick.set(0, 0);
}

window.addEventListener('resize', resize);
document.addEventListener('pointerlockchange', () => {
  controls.pointerLocked = document.pointerLockElement === el.canvas;
});

window.addEventListener('keydown', (event) => {
  if (!currentWorld) return;
  if (document.activeElement === el.chatInput) {
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      sendChatMessage();
      event.preventDefault();
    }
    if (event.code === 'Escape') toggleChat(false);
    return;
  }
  if (event.code === 'KeyC') {
    toggleChat();
    return;
  }
  if (event.code === 'KeyT' && event.repeat === false) {
    toggleFreeCam();
    return;
  }
  if (event.code === 'KeyI') {
    togglePause();
    return;
  }
  if (event.code === 'KeyE') {
    openInventory();
    return;
  }
  if (event.code === 'Space' && event.repeat === false && currentWorld.mode === 'creative') {
    const now = performance.now();
    if (now - player.lastSpaceTap < 320) {
      player.flyMode = !player.flyMode;
      player.velocity.y = 0;
      controls.jump = false;
      player.lastSpaceTap = 0;
      updateHud();
      return;
    }
    player.lastSpaceTap = now;
  }
  const slot = Number(event.key) - 1;
  if (slot >= 0 && slot < HOTBAR.length) selectItem(HOTBAR[slot]);
  setKey(event.code, true);
});

window.addEventListener('keyup', (event) => setKey(event.code, false));
window.addEventListener('mousemove', (event) => {
  if (controls.pointerLocked && running) {
    controls.lookDX += event.movementX;
    controls.lookDY += event.movementY;
  }
});

el.canvas.addEventListener('click', () => {
  if (running && !document.pointerLockElement) el.canvas.requestPointerLock();
});
el.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
el.canvas.addEventListener('mousedown', (event) => {
  if (!running) return;
  if (event.button === 0) interact(false);
  if (event.button === 2) interact(true);
});

window.addEventListener('touchstart', (event) => {
  if (!el.game.classList.contains('active')) return;
  for (const touch of event.changedTouches) {
    if (touch.clientX < window.innerWidth * 0.42 && controls.moveTouch === null) {
      controls.moveTouch = touch.identifier;
      updateJoystick(touch.clientX, touch.clientY);
    } else if (controls.lookTouch === null) {
      controls.lookTouch = touch.identifier;
      controls.lastLook = { x: touch.clientX, y: touch.clientY };
    }
  }
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  for (const touch of event.changedTouches) {
    if (touch.identifier === controls.moveTouch) updateJoystick(touch.clientX, touch.clientY);
    if (touch.identifier === controls.lookTouch && controls.lastLook) {
      controls.lookDX += touch.clientX - controls.lastLook.x;
      controls.lookDY += touch.clientY - controls.lastLook.y;
      controls.lastLook = { x: touch.clientX, y: touch.clientY };
    }
  }
}, { passive: true });

window.addEventListener('touchend', (event) => {
  for (const touch of event.changedTouches) {
    if (touch.identifier === controls.moveTouch) {
      controls.moveTouch = null;
      resetJoystick();
    }
    if (touch.identifier === controls.lookTouch) {
      controls.lookTouch = null;
      controls.lastLook = null;
    }
  }
}, { passive: true });

el.createWorld.onclick = () => createWorld(el.worldName.value.trim(), el.gameMode.value);
el.downloadWorld.onclick = downloadSelectedWorld;
el.pause.onclick = () => togglePause(true);
el.resume.onclick = () => togglePause(false);
el.shareWorld.onclick = shareCurrentWorld;
el.closeShare.onclick = () => {
  el.sharePanel.classList.add('hidden');
  el.pausePanel.classList.remove('hidden');
};
el.saveEditWorld.onclick = saveEditedWorld;
el.cancelEditWorld.onclick = () => el.editWorldPanel.classList.add('hidden');
el.pauseSettings.onclick = () => {
  persistCurrentWorld();
  togglePause(false);
  exitToHome();
};
el.saveExit.onclick = exitToHome;
el.closeInventory.onclick = () => el.inventoryPanel.classList.add('hidden');
el.mobileInventory.onclick = openInventory;
el.mobileJump.onclick = () => {
  controls.jump = true;
  window.setTimeout(() => { controls.jump = false; }, 150);
};
el.mobileBreak.onclick = () => {
  if (player.freeCam) {
    controls.descend = true;
    window.setTimeout(() => { controls.descend = false; }, 150);
    return;
  }
  interact(false);
};
el.mobilePlace.onclick = () => interact(true);
el.mobileCamera.onclick = toggleFreeCam;
el.mobileChat.onclick = () => toggleChat(true);
el.chatClose.onclick = () => toggleChat(false);
el.chatSend.onclick = sendChatMessage;
el.revive.onclick = () => {
  player.health = 100;
  player.oxygen = 100;
  player.position.set(0, terrainTopAt(0, 0) + PLAYER_HEIGHT + 2, 0);
  player.velocity.set(0, 0, 0);
  syncPlayerBodyToPosition();
  running = true;
  el.deathPanel.classList.add('hidden');
};
el.deathExit.onclick = exitToHome;
el.blockSearch.oninput = renderCreativeList;
el.onlineTest.onclick = testOnlineCode;
el.joinOnline.onclick = joinOnlineWorld;
el.exportMod.onclick = exportModTemplate;
el.modInput.onchange = async () => {
  const file = el.modInput.files?.[0];
  if (!file) return;
  const code = await file.text();
  mods.push({ name: file.name, code });
  saveMods();
  applyMods();
  renderMods();
  renderHotbar();
};
el.fps.onchange = saveSettings;
el.renderDistance.onchange = saveSettings;
el.username.onchange = saveSettings;
el.autoJump.onchange = saveSettings;
document.querySelectorAll('[data-recipe]').forEach((button) => {
  button.addEventListener('click', () => craft(button.dataset.recipe));
});

el.fps.value = String(settings.fps);
el.renderDistance.value = String(settings.renderDistance ?? 2);
el.username.value = settings.username;
el.autoJump.checked = settings.autoJump;
applyMods();
renderWorlds();
renderMods();
renderHotbar();
createClouds();
animate();