import { bindRenderResolution } from './RenderResolution';
import { AuroraSky } from 'winterarc-rendering';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { meshWorldBinaryGreedy } from 'winterarc-rendering';
import { TreeModels } from 'winterarc-rendering';
import { settings } from '../config/settings';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';

import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import '@babylonjs/loaders/glTF/index.js';

import { type GameId } from 'winterarc-core';
import { WorldFactory, PALETTE } from 'winterarc-world';

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

export class MenuPreviewEngine {
  private sky?: AuroraSky;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly roots = new Map<GameId, TransformNode>();
  private readonly resolution: ReturnType<typeof bindRenderResolution>;
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

    this.resolution = bindRenderResolution(this.engine, () => settings.get().renderScale);
    // Match the in-game DPR and pixel-budget policy.
    const applySettings = () => {
      this.sky?.setQuality(settings.get().skyQuality);
      this.resolution.refresh();
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
    this.camera.radius = resolved === 'wallduel' ? 34 : resolved === 'hunt' || resolved === 'codehunt' ? 112 : resolved === 'giftrace' ? 118 : 66;
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

    const buckets = meshWorldBinaryGreedy(world);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (this.disposed) return;

    for (const b of buckets.values()) {
      if (!b.indices.length) continue;
      const mesh = new Mesh(`${id}-${b.blockId}-${b.face}`, this.scene);
      const vertex = new VertexData();
      vertex.positions = b.positions;
      vertex.normals = b.normals;
      vertex.uvs = b.uvs;
      vertex.indices = b.indices;
      vertex.applyToMesh(mesh);
      mesh.parent = root;
      mesh.isPickable = false;

      const file = b.blockId === 1 ? (b.face === 2 ? 'snow' : b.face === 3 ? 'earth' : 'snow-side') : tiles[b.blockId];
      const material = new StandardMaterial(`${id}-material-${b.blockId}-${b.face}`, this.scene);
      material.specularColor = Color3.Black();
      material.backFaceCulling = false;
      material.diffuseColor = Color3.FromHexString(PALETTE[b.blockId][1]);
      if (file) {
        material.diffuseColor = Color3.White();
        const tex = new Texture(
          `/textures/${file}.png`,
          this.scene,
          false,
          false,
          Texture.NEAREST_SAMPLINGMODE,
        );
        tex.wrapU = Texture.WRAP_ADDRESSMODE;
        tex.wrapV = Texture.WRAP_ADDRESSMODE;
        material.diffuseTexture = tex;
      }
      if (b.blockId === 10) material.emissiveColor = Color3.FromHexString('#ffb347');
      mesh.material = material;
      mesh.freezeWorldMatrix();
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
    this.resolution.dispose();
    this.engine.stopRenderLoop(this.render);
    this.trees.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
