import type { Engine } from './WinterVoxelEngine';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MAP_HALF, PALETTE, type VoxelWorld } from 'winterarc-world';
import { BLOCK_TEXTURES, meshChunkBinaryGreedy } from 'winterarc-rendering';

const CHUNK = 16;

/**
 * In-game chunk renderer powered by Wasm Binary Greedy Meshing (`meshChunkBinaryGreedy`).
 * Replaces noa's internal naive voxel mesher for all full-cube and partial-shape blocks.
 */
export class PartialBlockRenderer {
  private chunks = new Map<string, Mesh[]>();
  private materials = new Map<string, StandardMaterial>();
  private world?: VoxelWorld;
  private occupied = new Set<string>();

  constructor(private noa: Engine) {}

  private material(id: number, face: number): StandardMaterial {
    const file = id === 1 ? (face === 2 ? 'snow' : face === 3 ? 'earth' : 'snow-side') : BLOCK_TEXTURES[id];
    const key = `${id}:${face}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const scene = this.noa.rendering.getScene();
    const m = new StandardMaterial(`bgm-${key}`, scene);
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
    m.diffuseColor = Color3.FromHexString(PALETTE[id][1]);
    if (file) {
      m.diffuseColor = Color3.White();
      const tex = new Texture(
        `/textures/${file}.png`,
        scene,
        false,
        false,
        Texture.NEAREST_SAMPLINGMODE,
        undefined,
        () => {
          m.diffuseTexture = null;
          m.diffuseColor = Color3.FromHexString(PALETTE[id][1]);
        },
      );
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      tex.wrapV = Texture.WRAP_ADDRESSMODE;
      m.diffuseTexture = tex;
    }
    if (id === 10) m.emissiveColor = Color3.FromHexString('#ffb347');
    this.materials.set(key, m);
    return m;
  }

  setWorld(world: VoxelWorld): void {
    this.clear();
    this.world = world;
    for (let x = -MAP_HALF; x < MAP_HALF; x += CHUNK) {
      for (let z = -MAP_HALF; z < MAP_HALF; z += CHUNK) {
        this.rebuild(x, z);
      }
    }
  }

  update(cells: readonly { x: number; y: number; z: number }[]): void {
    const keys = new Set<string>();
    for (const p of cells) {
      for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = Math.floor((p.x + dx) / CHUNK) * CHUNK;
        const z = Math.floor((p.z + dz) / CHUNK) * CHUNK;
        if (x >= -MAP_HALF && x < MAP_HALF && z >= -MAP_HALF && z < MAP_HALF) {
          const key = `${x}:${z}`;
          const changedId = this.world?.get(p.x, p.y, p.z) ?? 0;
          if (this.occupied.has(key) || changedId !== 0) keys.add(key);
        }
      }
    }
    for (const key of keys) {
      const [x, z] = key.split(':').map(Number);
      this.rebuild(x, z);
    }
  }

  private rebuild(cx: number, cz: number): void {
    const world = this.world;
    if (!world) return;
    const key = `${cx}:${cz}`;
    for (const mesh of this.chunks.get(key) ?? []) mesh.dispose();
    const buckets = meshChunkBinaryGreedy(world, cx, cz);
    const meshes: Mesh[] = [];
    for (const b of buckets.values()) {
      if (!b.indices.length) continue;
      const mesh = new Mesh(`bgm-${key}-${b.blockId}-${b.face}`, this.noa.rendering.getScene());
      const data = new VertexData();
      data.positions = b.positions;
      data.normals = b.normals;
      data.uvs = b.uvs;
      data.indices = b.indices;
      data.applyToMesh(mesh);
      mesh.material = this.material(b.blockId, b.face);
      mesh.isPickable = false;
      this.noa.rendering.addMeshToScene(mesh);
      mesh.freezeWorldMatrix();
      meshes.push(mesh);
    }
    if (meshes.length) this.occupied.add(key);
    else this.occupied.delete(key);
    this.chunks.set(key, meshes);
  }

  private clear(): void {
    for (const list of this.chunks.values()) for (const mesh of list) mesh.dispose();
    this.chunks.clear();
    this.occupied.clear();
  }

  dispose(): void {
    this.clear();
    for (const m of this.materials.values()) m.dispose(false, true);
    this.materials.clear();
  }
}
