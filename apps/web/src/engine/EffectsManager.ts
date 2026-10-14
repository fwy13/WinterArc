import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { randomFromSeed } from 'winterarc-world';
import type { ShotEvent } from 'winterarc-protocol';
import { MeshFactory } from './MeshFactory.js';

interface DebrisPiece {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
}

export class EffectsManager {
  private flakes: { x: number; y: number; z: number; s: number }[] = [];
  private matrices = new Float32Array(200 * 16);
  private snow: Mesh;
  private shots: { mesh: Mesh; event: ShotEvent; age: number }[] = [];
  private debrisList: DebrisPiece[] = [];

  constructor(private readonly meshes: MeshFactory) {
    this.snow = CreateBox('snowfall', { size: 0.065 }, meshes.scene);
    this.snow.material = meshes.material('#f1fafb', 0.5);
    meshes.noa.rendering.addMeshToScene(this.snow);
    this.snow.alwaysSelectAsActiveMesh = true;
    this.snow.isPickable = false;
    const random = randomFromSeed(801);
    for (let i = 0; i < 200; i++) {
      this.flakes.push({
        x: (random() - 0.5) * 52,
        y: random() * 27,
        z: (random() - 0.5) * 52,
        s: 0.5 + random() * 0.8,
      });
      const a = i * 16;
      this.matrices[a] = this.matrices[a + 5] = this.matrices[a + 10] = this.matrices[a + 15] = 1;
    }
    this.snow.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
  }

  shot(event: ShotEvent): void {
    const mesh = CreateSphere('snowball', { diameter: 0.23, segments: 6 }, this.meshes.scene);
    mesh.material = this.meshes.material(event.hit ? '#d3fcff' : '#f4f6ef', 0.8);
    mesh.isPickable = false;
    this.meshes.noa.rendering.addMeshToScene(mesh);
    mesh.position.set(...event.from);
    this.shots.push({ mesh, event, age: 0 });
    if (this.shots.length > 100) this.shots.shift()?.mesh.dispose();
  }

  /** Spawns tumbling voxel debris chunks when Boss Crab smashes structures or floor tiles. */
  burstDebris(x: number, y: number, z: number, color = '#78becb', count = 3): void {
    for (let i = 0; i < count; i++) {
      const mesh = CreateBox('voxel-debris', { size: 0.28 }, this.meshes.scene);
      mesh.material = this.meshes.material(color, 0.2);
      mesh.isPickable = false;
      this.meshes.noa.rendering.addMeshToScene(mesh);
      mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      const angle = ((i + Math.random() * 0.6) * Math.PI * 2) / count;
      const speed = 2.4 + Math.random() * 3.2;
      this.debrisList.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 4.5 + Math.random() * 3.8,
        vz: Math.sin(angle) * speed,
        age: 0,
      });
      if (this.debrisList.length > 96) this.debrisList.shift()?.mesh.dispose();
    }
  }

  render(dt: number, time: number): void {
    const p = this.meshes.noa.ents.getPosition(this.meshes.noa.playerEntity);
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      f.y -= dt * f.s * 1.5;
      if (f.y < 0) f.y += 27;
      const a = i * 16;
      this.matrices[a + 12] = p[0] + f.x + Math.sin(time * 0.3 + i) * 0.7;
      this.matrices[a + 13] = p[1] + f.y - 5;
      this.matrices[a + 14] = p[2] + f.z;
    }
    this.snow.thinInstanceBufferUpdated('matrix');
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.age += dt;
      const t = Math.min(1, s.age / 0.2);
      s.mesh.position.set(
        ...(s.event.from.map((v, j) => v + (s.event.to[j] - v) * t) as [number, number, number]),
      );
      if (s.age > 0.24) {
        s.mesh.dispose();
        this.shots.splice(i, 1);
      }
    }
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.age += dt;
      d.vy -= 18 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += 6 * dt;
      d.mesh.rotation.y += 5 * dt;
      if (d.age > 0.65) {
        d.mesh.dispose();
        this.debrisList.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const s of this.shots) s.mesh.dispose();
    this.shots = [];
    for (const d of this.debrisList) d.mesh.dispose();
    this.debrisList = [];
  }

  dispose(): void {
    this.clear();
    this.snow.dispose();
  }
}
