import { AuroraSky } from 'winterarc-rendering';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { shapeQuads, appendShapeQuad, type ShapeGeometry } from 'winterarc-rendering';
import { TreeModels } from 'winterarc-rendering';
import { settings } from '../config/settings';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';

import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/loaders/glTF/index.js';

import { type GameId } from 'winterarc-core';
import { WorldFactory, MAP_HALF, MAP_HEIGHT, PALETTE, blockShape } from 'winterarc-world';

const tiles: Record<number, string> = {
  1: 'snow',
  2: 'earth',
  3: 'wood',
  4: 'bark',
  5: 'pine',
  6: 'red-planks',
  8: 'ice',
  9: 'stone',
  11: 'dark-stone',
  12: 'gift',
  15: 'rug',
};

const neighbors = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export class MenuPreviewEngine {
  private sky?: AuroraSky;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly roots = new Map<GameId, TransformNode>();
  private readonly resize: ResizeObserver;
  private readonly trees: TreeModels;

  private selected: GameId = 'hunt';
  private active = true;
  private ready = false;
  private disposed = false;
  private angle = 0;
  private unsubscribeSettings: () => void = () => {};

  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);

    // Giới hạn độ phân giải render trên màn hình Retina.
    const applySettings = () => {
      this.sky?.setQuality(settings.get().skyQuality);
      this.engine.setHardwareScalingLevel(1 / settings.get().renderScale);
      this.engine.resize();
    };
    applySettings();
    this.unsubscribeSettings = settings.subscribe(applySettings);

    this.scene = new Scene(this.engine);
    this.sky = new AuroraSky(this.scene, settings.get().skyQuality);
    this.trees = new TreeModels(this.scene);
    this.scene.clearColor = new Color4(0.105, 0.19, 0.25, 1);

    this.camera = new ArcRotateCamera(
      'preview-camera',
      -1.1,
      0.9,
      72,
      new Vector3(0, 4, 0),
      this.scene,
    );

    this.camera.minZ = 0.2;
    this.camera.maxZ = 250;

    const light = new HemisphericLight('preview-light', new Vector3(0.4, 1, -0.3), this.scene);

    light.intensity = 1.1;
    light.groundColor = new Color3(0.28, 0.35, 0.4);

    this.resize = new ResizeObserver(() => this.engine.resize());
    this.resize.observe(canvas);
  }

  async initialize(): Promise<void> {
    for (const id of WorldFactory.getRegisteredIds()) {
      if (this.disposed) return;
      await this.build(id);
    }

    if (this.disposed) return;

    await this.scene.whenReadyAsync();

    if (this.disposed) return;

    this.ready = true;
    this.select(this.selected);
    this.setActive(this.active);
  }

  select(id: GameId): void {
    this.selected = id;

    if (!this.ready || this.disposed) return;

    const resolved = this.roots.has(id) ? id : this.roots.keys().next().value;

    if (!resolved) return;

    for (const [key, root] of this.roots) {
      root.setEnabled(key === resolved);
    }

    this.angle = 0;
    this.camera.alpha = -1.1;
    this.camera.beta = resolved === 'crab' ? 0.98 : 0.86;
    this.camera.radius = resolved === 'wallduel' ? 34 : resolved === 'hunt' ? 112 : resolved === 'giftrace' ? 104 : 66;
    this.camera.target.set(0, resolved === 'hunt' || resolved === 'crab' ? 4 : 8, 0);
  }

  setActive(active: boolean): void {
    this.active = active;

    if (!this.ready || this.disposed) return;

    this.engine.stopRenderLoop(this.render);

    if (active) {
      this.engine.resize();
      this.engine.runRenderLoop(this.render);
    }
  }

  private render = (): void => {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);

    if (!this.reducedMotion && settings.get().cameraBob) {
      this.angle += dt * 0.1;
    }

    this.camera.alpha = -1.1 + Math.sin(this.angle) * 0.12;
    this.scene.render();
  };

  private async build(id: GameId): Promise<void> {
    const world = WorldFactory.get(id);
    const root = new TransformNode(`preview-${id}`, this.scene);

    this.roots.set(id, root);

    const groups = new Map<number, number[]>();
    const matrix = Matrix.Identity();

    for (let x = -MAP_HALF; x < MAP_HALF; x++) {
      if (this.disposed) return;

      for (let z = -MAP_HALF; z < MAP_HALF; z++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
          const block = world.get(x, y, z);

          // Bỏ các block bị che kín.
          if (!block || !neighbors.some(([dx, dy, dz]) => !blockShape(world.get(x + dx, y + dy, z + dz)).fullCube)) {
            continue;
          }

          let buffer = groups.get(block);

          if (!buffer) {
            groups.set(block, (buffer = []));
          }

          matrix.setTranslationFromFloats(x + 0.5, y + 0.5, z + 0.5);
          matrix.copyToArray(buffer, buffer.length);
        }
      }

      // Nhường main thread trong quá trình khởi tạo.
      if ((x + MAP_HALF) % 4 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    if (this.disposed) return;

    for (const [block, buffer] of groups) {
      if (!blockShape(block).fullCube) {
        const geometries = new Map<number, ShapeGeometry>();
        for (const quad of shapeQuads(block)) {
          let data = geometries.get(quad.material);
          if (!data) { data = { positions: [], normals: [], uvs: [], indices: [] }; geometries.set(quad.material, data); }
          appendShapeQuad(data, quad, -0.5, -0.5, -0.5);
        }
        for (const [materialId, geometry] of geometries) {
          const mesh = new Mesh(`${id}-shape-${block}-${materialId}`, this.scene);
          const vertex = new VertexData(); Object.assign(vertex, geometry); vertex.applyToMesh(mesh);
          mesh.parent = root; mesh.isPickable = false;
          const material = new StandardMaterial(`preview-shape-${block}-${materialId}`, this.scene);
          material.specularColor = Color3.Black(); material.backFaceCulling = false;
          material.diffuseColor = Color3.FromHexString(PALETTE[materialId][1]);
          if (tiles[materialId]) {
            material.diffuseColor = Color3.White();
            material.diffuseTexture = new Texture(`/textures/${tiles[materialId]}.png`, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
          }
          if (materialId === 10) material.emissiveColor = Color3.FromHexString('#ffb347');
          mesh.material = material;
          mesh.thinInstanceSetBuffer('matrix', new Float32Array(buffer), 16, true);
          mesh.thinInstanceRefreshBoundingInfo();
        }
        continue;
      }
      const mesh = CreateBox(`${id}-${block}`, { size: 1 }, this.scene);

      mesh.parent = root;
      mesh.isPickable = false;

      const material = new StandardMaterial(`${id}-material-${block}`, this.scene);

      material.specularColor = Color3.Black();
      material.diffuseColor = Color3.FromHexString(PALETTE[block][1]);

      if (tiles[block]) {
        material.diffuseColor = Color3.White();
        material.diffuseTexture = new Texture(
          `/textures/${tiles[block]}.png`,
          this.scene,
          false,
          false,
          Texture.NEAREST_SAMPLINGMODE,
        );
      }

      mesh.material = material;

      // Gom các block cùng material thành thin instances.
      mesh.thinInstanceSetBuffer('matrix', new Float32Array(buffer), 16, true);

      mesh.thinInstanceRefreshBoundingInfo();
    }

    await this.trees.populate(world.trees, root);
    if (this.disposed) return;
    if (id === 'crab') {
      try {
        const model = await SceneLoader.LoadAssetContainerAsync(
          '/models/',
          'frost-crab.glb',
          this.scene,
        );

        if (this.disposed) {
          model.dispose();
          return;
        }

        const boss = new TransformNode('preview-boss', this.scene);
        boss.parent = root;
        boss.position.set(0, 3, 0);
        boss.rotation.y = Math.PI;

        model.addAllToScene();

        for (const node of model.rootNodes) {
          node.parent = boss;
        }
      } catch (error) {
        if (!this.disposed) {
          console.warn('Không tải được model cua trong preview', error);
        }
      }
    }
  }

  dispose(): void {
    this.sky?.dispose();
    this.unsubscribeSettings();
    this.disposed = true;
    this.resize.disconnect();
    this.engine.stopRenderLoop(this.render);
    this.trees.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
