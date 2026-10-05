// Motor de geração de mundo: FastNoise Lite.
// Mantém as assinaturas smoothNoise(seed, x, z, scale) e noise(seed, x, z)
// usadas pelo resto do jogo, devolvendo valores normalizados em [0, 1].
import FastNoiseLite from 'https://cdn.jsdelivr.net/npm/fastnoise-lite@1.1.0/+esm';

const generators = new Map();

function generator(seed, scale) {
  const key = `${seed}|${scale}`;
  let gen = generators.get(key);
  if (gen) return gen;
  gen = new FastNoiseLite();
  gen.SetSeed((Math.abs(Math.trunc(seed)) % 2147483647) || 1);
  gen.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  gen.SetFractalType(FastNoiseLite.FractalType.FBm);
  gen.SetFractalOctaves(3);
  gen.SetFrequency(1 / scale);
  generators.set(key, gen);
  return gen;
}

export function smoothNoise(seed, x, z, scale) {
  const value = generator(seed, scale).GetNoise(x, z); // [-1, 1]
  return (value + 1) * 0.5; // [0, 1]
}

export function noise(seed, x, z) {
  return (
    smoothNoise(seed, x, z, 80) * 0.48 +
    smoothNoise(seed + 11, x, z, 28) * 0.34 +
    smoothNoise(seed + 27, x, z, 11) * 0.18
  );
}
