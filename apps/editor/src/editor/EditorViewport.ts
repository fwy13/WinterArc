import { AuroraSky } from 'winterarc-rendering';
import type { SkyQuality } from 'winterarc-core';
import { meshChunkBinaryGreedy } from 'winterarc-rendering';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import '@babylonjs/core/Culling/ray.js';
import { MAP_HALF, PALETTE, VoxelWorld, traceBlockShape } from 'winterarc-world';
import { EYE_HEIGHT, STEP, collides, movePlayer } from 'winterarc-gameplay';
import { type Motion } from 'winterarc-core';
import { TreeModels } from 'winterarc-rendering';
import { BLOCK_TEXTURES } from 'winterarc-rendering';
import type { EditorDocument, Cell } from './EditorDocument';

const CHUNK = 16;
export type ViewMode = 'orbit' | 'fly' | 'play';

/** Standalone Babylon viewport; shares textures, tree models and game movement code. */
export class EditorViewport {
  private readonly sky: AuroraSky;
  private engine: Engine;
  private scene: Scene;
  private orbit: ArcRotateCamera;
  private first: FreeCamera;
  private meshes = new Map<string, Mesh[]>();
  private materials = new Map<string, StandardMaterial>();
  private dirty = new Set<string>();
  private trees: TreeModels;
  private decorations: TransformNode;
  private selection: Mesh;
  private observer: ResizeObserver;
  private keys = new Set<string>();
  private mode: ViewMode = 'orbit';
  private player: Motion = { x: 0, y: 10, z: 0, vy: 0, yaw: 0, pitch: 0 };
  private playWorld?: VoxelWorld;
  private accumulator = 0;
  private last = performance.now();
  private model?: EditorDocument;
  private down?: { x: number; y: number; button: number };
  onPick: (hit: Cell, place: Cell, remove: boolean) => void = () => {};
  onMode: (mode: ViewMode) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, skyQuality: SkyQuality = 'auto') {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    this.scene = new Scene(this.engine);
    this.sky = new AuroraSky(this.scene, skyQuality);
    this.scene.clearColor = new Color4(0.105, 0.19, 0.25, 1);
    this.scene.skipPointerMovePicking = true;
    new HemisphericLight('sky', new Vector3(0.4, 1, 0.2), this.scene).intensity = 0.95;
    this.orbit = new ArcRotateCamera('editor', -Math.PI / 2, 0.8, 80, new Vector3(0, 3, 0), this.scene);
    this.orbit.lowerRadiusLimit = 2; this.orbit.upperRadiusLimit = 260;
    this.orbit.wheelPrecision = 8;
    this.first = new FreeCamera('walk', new Vector3(0, 10, 0), this.scene);
    this.first.minZ = 0.05;
    this.orbit.attachControl(canvas, true);
    this.scene.activeCamera = this.orbit;
    const ground = CreateGround('reference-plane', { width: 160, height: 160 }, this.scene);
    ground.position.y = -0.02;
    ground.material = this.solid('plane', '#304b50', 0.7);
    this.selection = CreateBox('selection', {}, this.scene);
    const selectMaterial = this.solid('selection', '#ffe4a5'); selectMaterial.wireframe = true;
    this.selection.material = selectMaterial; this.selection.isPickable = false; this.selection.setEnabled(false);
    this.decorations = new TransformNode('decorations', this.scene);
    this.trees = new TreeModels(this.scene);
    this.observer = new ResizeObserver(() => this.engine.resize()); this.observer.observe(canvas);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('contextmenu', this.contextMenu);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('pointerlockchange', this.lockChanged);
    this.engine.runRenderLoop(this.render);
  }
  private solid(key: string, color: string, alpha = 1): StandardMaterial {
    let m = this.materials.get(key);
    if (!m) { m = new StandardMaterial(key, this.scene); m.diffuseColor = Color3.FromHexString(color); m.specularColor = Color3.Black(); m.backFaceCulling = false; m.alpha = alpha; this.materials.set(key, m); }
    return m;
  }
  private material(id: number, face: number): StandardMaterial {
    const file = id === 1 ? (face === 2 ? 'snow' : face === 3 ? 'earth' : 'snow-side') : BLOCK_TEXTURES[id];
    const key = file || String(id);
    let m = this.materials.get(key);
    if (!m) {
      m = this.solid(key, file ? '#ffffff' : PALETTE[id][1]);
      // Keep palette color on missing textures; model geometry remains editable.
      if (file) {
        const tex = new Texture(`/textures/${file}.png`, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE,
          undefined, () => { m!.diffuseTexture = null; m!.diffuseColor = Color3.FromHexString(PALETTE[id][1]); });
        tex.wrapU = Texture.WRAP_ADDRESSMODE;
        tex.wrapV = Texture.WRAP_ADDRESSMODE;
        m.diffuseTexture = tex;
      }
      if (id === 10) m.emissiveColor = Color3.FromHexString('#80683c');
    }
    return m;
  }
  setDocument(model: EditorDocument): void {
    this.setMode('orbit'); this.model = model;
    for (const meshes of this.meshes.values()) for (const mesh of meshes) mesh.dispose();
    this.meshes.clear(); this.dirty.clear();
    for (let x = -MAP_HALF; x < MAP_HALF; x += CHUNK) for (let z = -MAP_HALF; z < MAP_HALF; z += CHUNK) this.dirty.add(`${x}:${z}`);
    this.decorate(); this.focus([0, 3, 0]);
  }
  update(cells: Cell[] | null): void {
    if (!this.model) return;
    if (cells === null) { this.setDocument(this.model); return; }
    for (const [x, , z] of cells) {
      for (const [dx, dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
        const cx = Math.floor((x + dx) / CHUNK) * CHUNK, cz = Math.floor((z + dz) / CHUNK) * CHUNK;
        if (cx >= -MAP_HALF && cx < MAP_HALF && cz >= -MAP_HALF && cz < MAP_HALF) this.dirty.add(`${cx}:${cz}`);
      }
    }
    if (!cells.length) this.decorate();
  }
  private rebuild(key: string): void {
    const world = this.model!.world, [cx, cz] = key.split(':').map(Number);
    for (const mesh of this.meshes.get(key) ?? []) mesh.dispose();
    const buckets = meshChunkBinaryGreedy(world, cx, cz);
    const list: Mesh[] = [];
    for (const b of buckets.values()) {
      if (!b.indices.length) continue;
      const mesh = new Mesh(`chunk-${key}-${b.blockId}-${b.face}`, this.scene);
      const vertex = new VertexData();
      vertex.positions = b.positions;
      vertex.normals = b.normals;
      vertex.uvs = b.uvs;
      vertex.indices = b.indices;
      vertex.applyToMesh(mesh);
      mesh.material = this.material(b.blockId, b.face);
      mesh.freezeWorldMatrix();
      list.push(mesh);
    }
    this.meshes.set(key, list);
  }
  private decorate(): void {
    const model = this.model!;
    this.decorations.dispose(); this.decorations = new TransformNode('decorations', this.scene);
    void this.trees.populate(model.world.trees, this.decorations);
    const marker = (name: string, x: number, y: number, z: number, color: string, size = 0.6) => {
      const box = CreateBox(name, { size }, this.scene); box.position.set(x, y + size / 2, z);
      box.parent = this.decorations; box.material = this.solid(name, color); box.isPickable = false;
    };
    for (const [x, y, z] of model.world.lamps) marker('lamp', x, y - 0.5, z, '#ffe2a5', 1);
    for (const p of model.meta.spawns) marker('spawn', p.x, p.y, p.z, '#64ffaa');
    for (const p of model.meta.targets) marker('target', p.x, p.y, p.z, '#ffffff');
    for (const p of model.meta.checkpoints) marker('checkpoint', p.x, p.y, p.z, '#65cfff');
    if (model.meta.finish) { const p = model.meta.finish; marker('finish', p.x, p.y, p.z, '#ffd35c'); }
    for (const p of model.world.obstacles) {
      const box = CreateBox('collider', { width: p.radius * 2, depth: p.radius * 2, height: p.height }, this.scene);
      box.position.set(p.x, p.y + p.height / 2, p.z); box.parent = this.decorations; box.isPickable = false;
      const m = this.solid('collider', '#90c8ff'); m.wireframe = true; box.material = m;
    }
    if (model.meta.placement === 'overlay') {
      const m = this.solid('reserved', '#ff3355', 0.15); m.backFaceCulling = false;
      const mesh = model.meta.mode === 'colorfall'
        ? CreateBox('reserved', { width: 39, depth: 39, height: 48 }, this.scene)
        : CreateCylinder('reserved', { diameter: model.meta.mode === 'crab' ? 64 : 42, height: 48, tessellation: 64 }, this.scene);
      mesh.position.y = 24; mesh.parent = this.decorations; mesh.material = m; mesh.isPickable = false;
    }
  }
  select(a: Cell, b: Cell): void {
    this.selection.setEnabled(this.mode !== 'play');
    this.selection.position.set(...a.map((v, i) => (v + b[i] + 1) / 2) as Cell);
    this.selection.scaling.set(...a.map((v, i) => Math.abs(v - b[i]) + 1.02) as Cell);
  }
  focus(at: Cell): void { this.orbit.setTarget(new Vector3(...at)); }
  setMode(mode: ViewMode): void {
    if (mode === 'play' && this.model) {
      const p = this.model.world.spawn(0);
      if (collides(this.model.world, p.x, p.y, p.z)) throw new Error('Spawn intersects a block/collider. Move the spawn marker first.');
    }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.keys.clear(); this.accumulator = 0; this.mode = mode;
    this.orbit.detachControl();
    if (mode === 'orbit') { this.scene.activeCamera = this.orbit; this.orbit.attachControl(this.canvas, true); }
    else {
      this.scene.activeCamera = this.first;
      if (mode === 'play' && this.model) {
        // Gameplay simulation works on an isolated copy. The editor data is never mutated.
        const source = this.model.world;
        this.playWorld = new VoxelWorld(source.id, { isPlayable: (x, z) => source.isPlayable(x, z), spawn: i => source.spawn(i) });
        this.playWorld.data.set(source.data); this.playWorld.customSpawns = structuredClone(source.customSpawns);
        this.playWorld.obstacles.push(...structuredClone(source.obstacles)); this.playWorld.loseY = source.loseY;
        this.player = { ...source.spawn(0), vy: 0, yaw: 0, pitch: 0 };
        this.first.position.set(this.player.x, this.player.y + EYE_HEIGHT, this.player.z); this.first.rotation.setAll(0);
      } else { this.first.position.copyFrom(this.orbit.position); this.first.setTarget(this.orbit.target); }
    }
    this.selection.setEnabled(false); this.decorations.setEnabled(true);
    for (const mesh of this.decorations.getChildMeshes()) {
      if (['spawn', 'target', 'checkpoint', 'finish', 'collider', 'reserved'].includes(mesh.name)) mesh.setEnabled(mode !== 'play');
    }
    this.onMode(mode);
  }
  private keyDown = (event: KeyboardEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyQ','KeyE'].includes(event.code)) { event.preventDefault(); this.keys.add(event.code); }
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private blur = () => { this.keys.clear(); };
  private lockChanged = () => { if (document.pointerLockElement !== this.canvas) this.keys.clear(); };
  private contextMenu = (event: Event) => event.preventDefault();
  private pointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY, button: event.button };
    if (this.mode !== 'orbit' && document.pointerLockElement !== this.canvas) {
      this.down = undefined;
      try { void Promise.resolve(this.canvas.requestPointerLock()).catch(() => {}); } catch { /* Browser denied capture. */ }
    }
  };
  private pointerMove = (event: PointerEvent) => {
    if (document.pointerLockElement === this.canvas) {
      this.first.rotation.y += event.movementX * 0.002;
      this.first.rotation.x = Math.max(-1.5, Math.min(1.5, this.first.rotation.x + event.movementY * 0.002));
    }
  };
  private pointerUp = (event: PointerEvent) => {
    const down = this.down; this.down = undefined;
    if (!down || this.mode === 'play' || (this.mode === 'orbit' && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5)) return;
    const rect = this.canvas.getBoundingClientRect();
    const locked = document.pointerLockElement === this.canvas;
    const ray = this.scene.createPickingRay(locked ? rect.width/2 : event.clientX-rect.left,
      locked ? rect.height/2 : event.clientY-rect.top, Matrix.Identity(), this.scene.activeCamera);
    const origin: Cell = [ray.origin.x,ray.origin.y,ray.origin.z];
    const direction: Cell = [ray.direction.x,ray.direction.y,ray.direction.z];
    const hit = this.model ? traceBlockShape(this.model.world,origin,direction,500) : null;
    if (hit) {
      this.onPick([hit.x,hit.y,hit.z],[hit.x+hit.normal[0],hit.y+hit.normal[1],hit.z+hit.normal[2]],event.button===2);
    } else if (direction[1] < -1e-8) {
      const distance = -origin[1]/direction[1];
      if(distance<0 || distance>500)return;
      const cell:Cell=[Math.floor(origin[0]+direction[0]*distance),0,Math.floor(origin[2]+direction[2]*distance)];
      this.onPick(cell,cell,event.button===2);
    }
  };
  private render = () => {
    const now = performance.now(), dt = Math.min((now - this.last) / 1000, 0.1); this.last = now;
    const end = performance.now() + 8;
    while (this.dirty.size && performance.now() < end) { const key = this.dirty.values().next().value!; this.dirty.delete(key); this.rebuild(key); }
    if (document.pointerLockElement === this.canvas && this.mode !== 'orbit') {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      if (this.mode === 'play' && this.playWorld) {
        this.accumulator += dt;
        while (this.accumulator >= STEP) {
          movePlayer(this.player, { forward, side, jump: this.keys.has('Space'), sprint, yaw: this.first.rotation.y, pitch: this.first.rotation.x }, this.playWorld);
          if (this.player.y < this.playWorld.loseY) Object.assign(this.player, this.playWorld.spawn(0), { vy: 0 });
          this.accumulator -= STEP;
        }
        this.first.position.set(this.player.x, this.player.y + EYE_HEIGHT, this.player.z);
      } else {
        const speed = (sprint ? 28 : 12) * dt, yaw = this.first.rotation.y;
        this.first.position.x += (Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed;
        this.first.position.z += (Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed;
        this.first.position.y += (Number(this.keys.has('Space') || this.keys.has('KeyE')) - Number(this.keys.has('KeyQ'))) * speed;
      }
    }
    if (!document.hidden) this.scene.render();
  };
  setSkyQuality(quality: SkyQuality): void { this.sky.setQuality(quality); }

  dispose(): void {
    this.sky.dispose();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.observer.disconnect(); this.engine.stopRenderLoop(this.render);
    this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointermove', this.pointerMove); this.canvas.removeEventListener('contextmenu', this.contextMenu);
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur);
    document.removeEventListener('pointerlockchange', this.lockChanged);
    this.trees.dispose(); this.scene.dispose(); this.engine.dispose();
  }
}
