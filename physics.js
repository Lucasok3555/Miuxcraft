// Motor de física: Rapier.js.
// Corpo dinâmico (cápsula) para o jogador e colisores de cubo estáticos para os
// blocos sólidos do mundo. A colisão entre o jogador e o terreno é resolvida
// automaticamente pelo Rapier; o chão é detectado consultando o mapa de voxels.
import { World, init, RigidBodyDesc, ColliderDesc, EventQueue } from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/+esm';

let world = null;
let eventQueue = null;
let terrainBody = null;
let playerBody = null;
let playerCollider = null;
let ready = false;

const blockColliders = new Map();

const PLAYER_RADIUS = 0.35;
const PLAYER_HALF = 0.525; // meia-altura da cápsula (parte cilíndrica)
const PLAYER_EYE_OFFSET = PLAYER_HALF + PLAYER_RADIUS; // 0.875

export async function ensurePhysics() {
  if (ready) return true;
  try {
    await init();
    world = new World(0, -23, 0);
    eventQueue = new EventQueue();
    ready = true;
    return true;
  } catch (error) {
    console.error('Rapier init falhou:', error);
    ready = false;
    return false;
  }
}

export function physicsReady() {
  return ready;
}

export function resetPhysics() {
  if (!ready) return;
  for (const collider of blockColliders.values()) {
    try { world.removeCollider(collider, true); } catch { /* noop */ }
  }
  blockColliders.clear();
  if (playerBody) { try { world.removeRigidBody(playerBody); } catch { /* noop */ } }
  playerBody = null;
  playerCollider = null;
  if (terrainBody) { try { world.removeRigidBody(terrainBody); } catch { /* noop */ } }
  terrainBody = null;
}

export function createTerrainBody() {
  if (!ready || terrainBody) return;
  terrainBody = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 0, 0));
}

export function createPlayerBody(x, y, z) {
  if (!ready) return;
  if (playerBody) world.removeRigidBody(playerBody);
  playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .lockRotations()
      .setLinearDamping(0.0)
  );
  playerCollider = world.createCollider(
    ColliderDesc.capsule(PLAYER_HALF, PLAYER_RADIUS)
      .setTranslation(0, -PLAYER_EYE_OFFSET, 0)
      .setFriction(0.85)
      .setRestitution(0.0),
    playerBody
  );
}

export function addBlockCollider(x, y, z) {
  if (!ready || !terrainBody) return;
  const k = `${x}|${y}|${z}`;
  if (blockColliders.has(k)) return;
  const collider = world.createCollider(
    ColliderDesc.cuboid(0.5, 0.5, 0.5)
      .setTranslation(x + 0.5, y + 0.5, z + 0.5)
      .setFriction(0.85),
    terrainBody
  );
  blockColliders.set(k, collider);
}

export function removeBlockCollider(x, y, z) {
  if (!ready) return;
  const k = `${x}|${y}|${z}`;
  const collider = blockColliders.get(k);
  if (!collider) return;
  world.removeCollider(collider, true);
  blockColliders.delete(k);
}

export function setPlayerVelocity(x, y, z) {
  if (!ready || !playerBody) return;
  playerBody.setLinvel(x, y, z, true);
}

export function setPlayerGravityScale(scale) {
  if (!ready || !playerBody) return;
  playerBody.setGravityScale(scale, true);
}

export function setPlayerTranslation(x, y, z) {
  if (!ready || !playerBody) return;
  playerBody.setTranslation(x, y, z, true);
}

export function getPlayerTranslation() {
  if (!ready || !playerBody) return null;
  return playerBody.translation();
}

export function getPlayerLinvel() {
  if (!ready || !playerBody) return { x: 0, y: 0, z: 0 };
  return playerBody.linvel();
}

export function stepPhysics() {
  if (!ready) return;
  world.step(eventQueue);
}
