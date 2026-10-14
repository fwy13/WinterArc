import { MAP_HALF, MAP_HEIGHT, blockShape, type VoxelWorld } from 'winterarc-world';
import { appendShapeQuad, shapeQuads, type ShapeGeometry } from './ShapeGeometry.js';

/**
 * Pre-compiled WebAssembly binary kernel for bitwise column face-culling:
 * Exports `memory` (1 page = 64 KB) and `cullColumns(count: i32, validMask: i32)`.
 * For each packed 32-bit occupancy column `col` at `u32[i]`:
 *   posMask[i] = (col & ~(col >>> 1)) & validMask   (at byte offset 16384)
 *   negMask[i] = (col & ~(col <<  1)) & validMask   (at byte offset 32768)
 */
const WASM_CULL_BYTES = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 2, 127, 127, 0, 3, 2, 1, 0, 5, 3, 1, 0, 1, 7, 24, 2,
  6, 109, 101, 109, 111, 114, 121, 2, 0, 11, 99, 117, 108, 108, 67, 111, 108, 117, 109, 110, 115,
  0, 0, 10, 88, 1, 86, 1, 3, 127, 32, 0, 65, 2, 116, 33, 3, 65, 0, 33, 2, 2, 64, 3, 64, 32, 2, 32,
  3, 79, 13, 1, 32, 2, 40, 2, 0, 33, 4, 32, 2, 32, 4, 32, 4, 65, 1, 118, 65, 127, 115, 113, 32, 1,
  113, 54, 2, 128, 128, 1, 32, 2, 32, 4, 32, 4, 65, 1, 116, 65, 127, 115, 113, 32, 1, 113, 54, 2,
  128, 128, 2, 32, 2, 65, 4, 106, 33, 2, 12, 0, 11, 11, 11,
]);

interface WasmCullKernel {
  u32: Uint32Array;
  cullColumns(count: number, validMask: number): void;
}

let kernel: WasmCullKernel | null = null;
function getKernel(): WasmCullKernel {
  if (kernel) return kernel;
  try {
    const mod = new WebAssembly.Module(WASM_CULL_BYTES);
    const inst = new WebAssembly.Instance(mod) as unknown as {
      exports: { memory: WebAssembly.Memory; cullColumns(count: number, validMask: number): void };
    };
    kernel = {
      u32: new Uint32Array(inst.exports.memory.buffer),
      cullColumns: inst.exports.cullColumns,
    };
  } catch {
    const u32 = new Uint32Array(16384);
    kernel = {
      u32,
      cullColumns(count: number, validMask: number): void {
        for (let i = 0; i < count; i++) {
          const col = u32[i];
          u32[4096 + i] = col & ~(col >>> 1) & validMask;
          u32[8192 + i] = col & ~(col << 1) & validMask;
        }
      },
    };
  }
  return kernel;
}

const ctz32 = (n: number): number => 31 - Math.clz32(n & -n);

// Lookup table for fullCube block IDs (avoids repeated function/object lookups in hot loops).
const FULL_CUBE_LUT = new Uint8Array(256);
for (let id = 1; id < 256; id++) {
  if (blockShape(id).fullCube) FULL_CUBE_LUT[id] = 1;
}

export interface GreedyMeshBucket extends ShapeGeometry {
  blockId: number;
  face: number;
}

function ensureBucket(
  buckets: Map<number, GreedyMeshBucket>,
  blockId: number,
  face: number,
): GreedyMeshBucket {
  const canonicalFace = blockId === 1 ? (face === 2 ? 2 : face === 3 ? 3 : 0) : 0;
  const key = (blockId << 3) | canonicalFace;
  let b = buckets.get(key);
  if (!b) {
    b = { blockId, face: canonicalFace, positions: [], normals: [], uvs: [], indices: [] };
    buckets.set(key, b);
  }
  return b;
}

function emitGreedyQuad(
  b: GreedyMeshBucket,
  face: number,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  h: number,
): void {
  const offset = b.positions.length / 3;
  if (face === 0) {
    b.positions.push(
      x0 + 1, y0,     z0,
      x0 + 1, y0 + h, z0,
      x0 + 1, y0 + h, z0 + w,
      x0 + 1, y0,     z0 + w,
    );
    b.normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
    b.uvs.push(0, 0, 0, h, w, h, w, 0);
  } else if (face === 1) {
    b.positions.push(
      x0, y0,     z0 + w,
      x0, y0 + h, z0 + w,
      x0, y0 + h, z0,
      x0, y0,     z0,
    );
    b.normals.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
    b.uvs.push(0, 0, 0, h, w, h, w, 0);
  } else if (face === 2) {
    b.positions.push(
      x0,     y0 + 1, z0 + h,
      x0 + w, y0 + 1, z0 + h,
      x0 + w, y0 + 1, z0,
      x0,     y0 + 1, z0,
    );
    b.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    b.uvs.push(0, 0, 0, w, h, w, h, 0);
  } else if (face === 3) {
    b.positions.push(
      x0,     y0, z0,
      x0 + w, y0, z0,
      x0 + w, y0, z0 + h,
      x0,     y0, z0 + h,
    );
    b.normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
    b.uvs.push(0, 0, 0, w, h, w, h, 0);
  } else if (face === 4) {
    b.positions.push(
      x0 + w, y0,     z0 + 1,
      x0 + w, y0 + h, z0 + 1,
      x0,     y0 + h, z0 + 1,
      x0,     y0,     z0 + 1,
    );
    b.normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
    b.uvs.push(0, 0, 0, h, w, h, w, 0);
  } else {
    b.positions.push(
      x0,     y0,     z0,
      x0,     y0 + h, z0,
      x0 + w, y0 + h, z0,
      x0 + w, y0,     z0,
    );
    b.normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
    b.uvs.push(0, 0, 0, h, w, h, w, 0);
  }
  b.indices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2);
}

// Reusable scratch buffers (zero GC allocations per chunk).
const chunkIds = new Uint8Array(16 * 16 * MAP_HEIGHT);
const planeMasks = Array.from({ length: 16 }, () => new Uint32Array(MAP_HEIGHT));
const planeIds = Array.from({ length: 16 }, () => new Uint8Array(16 * MAP_HEIGHT));
const yRowMask = new Uint32Array(16);
const yPlaneIds = new Uint8Array(256);

function greedyMergePlanes(
  buckets: Map<number, GreedyMeshBucket>,
  face: number,
  minY: number,
  maxY: number,
  cx: number,
  cz: number,
): void {
  for (let s = 0; s < 16; s++) {
    const rowMask = planeMasks[s];
    const ids = planeIds[s];
    for (let v = minY; v <= maxY; v++) {
      let mask = rowMask[v];
      if (!mask) continue;
      while (mask !== 0) {
        const u = ctz32(mask);
        const cellIdx = (v << 4) | u;
        const id = ids[cellIdx];
        let w = 1;
        while (u + w < 16 && (mask & (1 << (u + w))) !== 0 && ids[cellIdx + w] === id) {
          w++;
        }
        const spanMask = ((1 << w) - 1) << u;
        mask &= ~spanMask;
        rowMask[v] = mask;

        let h = 1;
        while (v + h <= maxY && (rowMask[v + h] & spanMask) === spanMask) {
          const nextRowBase = (v + h) << 4;
          let match = true;
          for (let du = 0; du < w; du++) {
            if (ids[nextRowBase + u + du] !== id) {
              match = false;
              break;
            }
          }
          if (!match) break;
          rowMask[v + h] &= ~spanMask;
          h++;
        }

        const bucket = ensureBucket(buckets, id, face);
        if (face === 0 || face === 1) {
          emitGreedyQuad(bucket, face, cx + s, v, cz + u, w, h);
        } else {
          emitGreedyQuad(bucket, face, cx + u, v, cz + s, w, h);
        }
      }
    }
  }
}

/**
 * Meshes a 16x48x16 chunk at (cx, cz) using single-pass voxel caching, active Y-bounds pruning,
 * Wasm bitwise column culling, and 2D binary greedy plane merging.
 */
export function meshChunkBinaryGreedy(
  world: VoxelWorld,
  cx: number,
  cz: number,
  buckets = new Map<number, GreedyMeshBucket>(),
): Map<number, GreedyMeshBucket> {
  const raw = world.data;
  const worldSize = world.size;
  let minY = MAP_HEIGHT;
  let maxY = -1;

  // Single pass over the 16x16x48 chunk using direct typed-array indexing.
  for (let dx = 0; dx < 16; dx++) {
    const x = cx + dx;
    const xBase = (x + MAP_HALF) * worldSize;
    for (let dz = 0; dz < 16; dz++) {
      const z = cz + dz;
      const colOffset = (xBase + z + MAP_HALF) * MAP_HEIGHT;
      const localBase = ((dx << 4) | dz) * MAP_HEIGHT;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const id = raw[colOffset + y];
        chunkIds[localBase + y] = id;
        if (!id) continue;
        if (FULL_CUBE_LUT[id]) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          for (const q of shapeQuads(id)) {
            const [nx, ny, nz] = q.normal;
            if (q.boundary && FULL_CUBE_LUT[world.get(x + nx, y + ny, z + nz)]) continue;
            appendShapeQuad(ensureBucket(buckets, q.material, 0), q, x, y, z);
          }
        }
      }
    }
  }

  // Empty chunk fast-exit (0 full cubes).
  if (maxY < minY) return buckets;

  const { u32, cullColumns } = getKernel();
  const valid16 = 0x1fffe;
  const yCount = maxY - minY + 1;
  const colTotal = yCount << 4;

  // 1. X-axis binary columns across active Y range [minY..maxY].
  let colIdx = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let dz = 0; dz < 16; dz++) {
      const z = cz + dz;
      let col = FULL_CUBE_LUT[world.get(cx - 1, y, z)] ? 1 : 0;
      if (FULL_CUBE_LUT[world.get(cx + 16, y, z)]) col |= 1 << 17;
      for (let dx = 0; dx < 16; dx++) {
        if (FULL_CUBE_LUT[chunkIds[((dx << 4) | dz) * MAP_HEIGHT + y]]) col |= 1 << (dx + 1);
      }
      u32[colIdx++] = col;
    }
  }
  cullColumns(colTotal, valid16);

  for (let s = 0; s < 16; s++) planeMasks[s].fill(0, minY, maxY + 1);
  for (let i = 0; i < colTotal; i++) {
    let pm = u32[4096 + i];
    if (!pm) continue;
    const y = minY + (i >> 4);
    const dz = i & 15;
    while (pm !== 0) {
      const dx = ctz32(pm) - 1;
      pm &= pm - 1;
      planeMasks[dx][y] |= 1 << dz;
      planeIds[dx][(y << 4) | dz] = chunkIds[((dx << 4) | dz) * MAP_HEIGHT + y];
    }
  }
  greedyMergePlanes(buckets, 0, minY, maxY, cx, cz);

  for (let s = 0; s < 16; s++) planeMasks[s].fill(0, minY, maxY + 1);
  for (let i = 0; i < colTotal; i++) {
    let nm = u32[8192 + i];
    if (!nm) continue;
    const y = minY + (i >> 4);
    const dz = i & 15;
    while (nm !== 0) {
      const dx = ctz32(nm) - 1;
      nm &= nm - 1;
      planeMasks[dx][y] |= 1 << dz;
      planeIds[dx][(y << 4) | dz] = chunkIds[((dx << 4) | dz) * MAP_HEIGHT + y];
    }
  }
  greedyMergePlanes(buckets, 1, minY, maxY, cx, cz);

  // 2. Z-axis binary columns across active Y range [minY..maxY].
  colIdx = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let dx = 0; dx < 16; dx++) {
      const x = cx + dx;
      const dxBase = dx << 4;
      let col = FULL_CUBE_LUT[world.get(x, y, cz - 1)] ? 1 : 0;
      if (FULL_CUBE_LUT[world.get(x, y, cz + 16)]) col |= 1 << 17;
      for (let dz = 0; dz < 16; dz++) {
        if (FULL_CUBE_LUT[chunkIds[(dxBase | dz) * MAP_HEIGHT + y]]) col |= 1 << (dz + 1);
      }
      u32[colIdx++] = col;
    }
  }
  cullColumns(colTotal, valid16);

  for (let s = 0; s < 16; s++) planeMasks[s].fill(0, minY, maxY + 1);
  for (let i = 0; i < colTotal; i++) {
    let pm = u32[4096 + i];
    if (!pm) continue;
    const y = minY + (i >> 4);
    const dx = i & 15;
    while (pm !== 0) {
      const dz = ctz32(pm) - 1;
      pm &= pm - 1;
      planeMasks[dz][y] |= 1 << dx;
      planeIds[dz][(y << 4) | dx] = chunkIds[((dx << 4) | dz) * MAP_HEIGHT + y];
    }
  }
  greedyMergePlanes(buckets, 4, minY, maxY, cx, cz);

  for (let s = 0; s < 16; s++) planeMasks[s].fill(0, minY, maxY + 1);
  for (let i = 0; i < colTotal; i++) {
    let nm = u32[8192 + i];
    if (!nm) continue;
    const y = minY + (i >> 4);
    const dx = i & 15;
    while (nm !== 0) {
      const dz = ctz32(nm) - 1;
      nm &= nm - 1;
      planeMasks[dz][y] |= 1 << dx;
      planeIds[dz][(y << 4) | dx] = chunkIds[((dx << 4) | dz) * MAP_HEIGHT + y];
    }
  }
  greedyMergePlanes(buckets, 5, minY, maxY, cx, cz);

  // 3. Y-axis binary columns across active Y bands.
  for (let yBase = minY; yBase <= maxY; yBase += 24) {
    const bandLen = Math.min(24, maxY - yBase + 1);
    const validBand = ((1 << bandLen) - 1) << 1;
    colIdx = 0;
    for (let dz = 0; dz < 16; dz++) {
      for (let dx = 0; dx < 16; dx++) {
        const localBase = ((dx << 4) | dz) * MAP_HEIGHT;
        let col = yBase > 0 && FULL_CUBE_LUT[chunkIds[localBase + yBase - 1]] ? 1 : 0;
        if (yBase + bandLen < MAP_HEIGHT && FULL_CUBE_LUT[chunkIds[localBase + yBase + bandLen]]) {
          col |= 1 << (bandLen + 1);
        }
        for (let dy = 0; dy < bandLen; dy++) {
          if (FULL_CUBE_LUT[chunkIds[localBase + yBase + dy]]) col |= 1 << (dy + 1);
        }
        u32[colIdx++] = col;
      }
    }
    cullColumns(256, validBand);

    for (const [face, offsetBase] of [
      [2, 4096],
      [3, 8192],
    ] as const) {
      for (let dy = 0; dy < bandLen; dy++) {
        const bit = 1 << (dy + 1);
        const y = yBase + dy;
        let anyInSlice = false;
        yRowMask.fill(0);
        for (let dz = 0; dz < 16; dz++) {
          let rMask = 0;
          const rowBase = dz << 4;
          for (let dx = 0; dx < 16; dx++) {
            if ((u32[offsetBase + rowBase + dx] & bit) !== 0) {
              rMask |= 1 << dx;
              yPlaneIds[rowBase + dx] = chunkIds[((dx << 4) | dz) * MAP_HEIGHT + y];
            }
          }
          if (rMask !== 0) {
            yRowMask[dz] = rMask;
            anyInSlice = true;
          }
        }
        if (!anyInSlice) continue;

        for (let dz = 0; dz < 16; dz++) {
          let mask = yRowMask[dz];
          if (!mask) continue;
          while (mask !== 0) {
            const dx = ctz32(mask);
            const cellIdx = (dz << 4) | dx;
            const id = yPlaneIds[cellIdx];
            let w = 1;
            while (dx + w < 16 && (mask & (1 << (dx + w))) !== 0 && yPlaneIds[cellIdx + w] === id) {
              w++;
            }
            const spanMask = ((1 << w) - 1) << dx;
            mask &= ~spanMask;
            yRowMask[dz] = mask;

            let h = 1;
            while (dz + h < 16 && (yRowMask[dz + h] & spanMask) === spanMask) {
              const nextRow = (dz + h) << 4;
              let match = true;
              for (let du = 0; du < w; du++) {
                if (yPlaneIds[nextRow + dx + du] !== id) {
                  match = false;
                  break;
                }
              }
              if (!match) break;
              yRowMask[dz + h] &= ~spanMask;
              h++;
            }
            emitGreedyQuad(ensureBucket(buckets, id, face), face, cx + dx, y, cz + dz, w, h);
          }
        }
      }
    }
  }

  return buckets;
}

/**
 * Meshes an entire VoxelWorld into material buckets using 16x48x16 Binary Greedy Meshing chunks.
 */
export function meshWorldBinaryGreedy(world: VoxelWorld): Map<number, GreedyMeshBucket> {
  const buckets = new Map<number, GreedyMeshBucket>();
  for (let cx = -MAP_HALF; cx < MAP_HALF; cx += 16) {
    for (let cz = -MAP_HALF; cz < MAP_HALF; cz += 16) {
      meshChunkBinaryGreedy(world, cx, cz, buckets);
    }
  }
  return buckets;
}
