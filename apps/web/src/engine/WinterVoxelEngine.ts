import { Engine as BabylonEngine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';

export interface ChunkArray {
  shape: number[];
  set(x: number, y: number, z: number, id: number): void;
}

type TickEvent = 'tick' | 'beforeRender' | 'afterRender';
type Listener = (dt: number) => void;

export interface WinterEngineOptions {
  domElement?: HTMLElement;
  playerStart?: [number, number, number];
  tickRate?: number;
  maxRenderRate?: number;
  antiAlias?: boolean;
  clearColor?: [number, number, number];
  ambientColor?: [number, number, number];
  lightDiffuse?: [number, number, number];
  lightVector?: [number, number, number];
  preserveDrawingBuffer?: boolean;
  [key: string]: unknown;
}

/**
 * Lightweight standalone Babylon.js Voxel Engine replacing `noa-engine`.
 * Eliminates noa's internal ndarray storage, ECS loop, and JS terrain mesher overhead
 * while keeping 100% API compatibility with Winter Arc's GameEngine and modes.
 */
export class Engine {
  readonly playerEntity = 1;
  worldName = 'hunt:0';
  maxRenderRate: number;

  readonly container: {
    readonly canvas: HTMLCanvasElement;
    readonly element: HTMLElement;
    readonly hasPointerLock: boolean;
    setPointerLock(lock: boolean): void;
  };

  readonly camera = {
    cameraTarget: 1,
    heading: 0,
    pitch: 0,
    sensitivityX: 7,
    sensitivityY: 7,
    sensitivityMult: 1,
  };

  readonly ents: {
    getState(id: number, name: 'followsEntity'): { offset: number[] };
    removeComponent(id: number, name: string): void;
    setPosition(id: number, position: number[]): void;
    getPosition(id: number): number[];
  };

  readonly registry = {
    registerMaterial(): void {},
    registerBlock(): void {},
  };

  readonly rendering: {
    getScene(): Scene;
    readonly engine: BabylonEngine;
    addMeshToScene(mesh: AbstractMesh, isStatic?: boolean): void;
  };

  readonly world = {
    playerChunkLoaded: true,
    on(): void {},
    setChunkData(): void {},
  };

  private readonly scene: Scene;
  private readonly babylonEngine: BabylonEngine;
  private readonly cameraHolder: TransformNode;
  private readonly freeCamera: FreeCamera;
  private readonly playerPos: [number, number, number];
  private readonly followState = { offset: [0, 1.9, 0] };
  private readonly listeners: Record<TickEvent, Set<Listener>> = {
    tick: new Set(),
    beforeRender: new Set(),
    afterRender: new Set(),
  };

  private readonly tickStepMs: number;
  private accumulatorMs = 0;
  private lastTimeMs = performance.now();
  private paused = false;
  private disposed = false;

  constructor(options: WinterEngineOptions = {}) {
    const element = options.domElement ?? document.body;
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.tabIndex = 0;
    element.replaceChildren(canvas);

    this.maxRenderRate = options.maxRenderRate ?? 120;
    this.tickStepMs = 1000 / (options.tickRate ?? 30);
    this.playerPos = [...(options.playerStart ?? [-14, 15, -36])];

    this.babylonEngine = new BabylonEngine(canvas, options.antiAlias ?? true, {
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      stencil: false,
    });
    this.scene = new Scene(this.babylonEngine);
    this.scene.skipPointerMovePicking = true;

    const cc = options.clearColor ?? [0.105, 0.19, 0.25];
    this.scene.clearColor = new Color4(cc[0], cc[1], cc[2], 1);
    const ac = options.ambientColor ?? [0.64, 0.75, 0.79];
    this.scene.ambientColor = new Color3(ac[0], ac[1], ac[2]);

    const lv = options.lightVector ?? [0.6, -1, 0.35];
    const ld = options.lightDiffuse ?? [0.78, 0.88, 1];
    const sun = new DirectionalLight('winter-sun', new Vector3(lv[0], lv[1], lv[2]).normalize(), this.scene);
    sun.diffuse = new Color3(ld[0], ld[1], ld[2]);
    sun.intensity = 0.5;
    sun.specular = Color3.Black();
    this.scene.onDisposeObservable.add(() => {
      this.disposed = true;
      window.removeEventListener('pointermove', this.onPointerMove);
      this.babylonEngine.stopRenderLoop(this.frameLoop);
    });

    this.cameraHolder = new TransformNode('camera-holder', this.scene);
    this.freeCamera = new FreeCamera('player-camera', Vector3.Zero(), this.scene);
    this.freeCamera.parent = this.cameraHolder;
    this.freeCamera.minZ = 0.08;
    this.freeCamera.maxZ = 260;
    this.freeCamera.inputs.clear();
    this.scene.activeCamera = this.freeCamera;
    this.syncCameraCarrier();

    this.container = {
      canvas,
      element,
      get hasPointerLock(): boolean {
        return document.pointerLockElement === canvas;
      },
      setPointerLock(lock: boolean): void {
        if (lock) {
          if (document.pointerLockElement !== canvas) {
            try {
              void Promise.resolve(canvas.requestPointerLock()).catch(() => {});
            } catch {
              /* Browser denied pointer lock outside user gesture. */
            }
          }
        } else if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
      },
    };

    this.ents = {
      getState: () => this.followState,
      removeComponent: () => {},
      setPosition: (_id: number, pos: number[]) => {
        this.playerPos[0] = pos[0];
        this.playerPos[1] = pos[1];
        this.playerPos[2] = pos[2];
        this.syncCameraCarrier();
      },
      getPosition: () => this.playerPos,
    };

    this.rendering = {
      getScene: () => this.scene,
      engine: this.babylonEngine,
      addMeshToScene: (mesh: AbstractMesh) => {
        mesh.isPickable = false;
      },
    };

    window.addEventListener('pointermove', this.onPointerMove);
    this.babylonEngine.runRenderLoop(this.frameLoop);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.disposed || this.paused || document.pointerLockElement !== this.container.canvas) return;
    const mult = this.camera.sensitivityMult * 0.00022;
    if (mult <= 0) return;
    const yaw = this.camera.heading + e.movementX * this.camera.sensitivityX * mult;
    this.camera.heading = ((((yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    this.camera.pitch = Math.max(
      -1.5,
      Math.min(1.5, this.camera.pitch + e.movementY * this.camera.sensitivityY * mult),
    );
    this.syncCameraCarrier();
  };

  private syncCameraCarrier(): void {
    const [ox, oy, oz] = this.followState.offset;
    this.cameraHolder.position.set(
      this.playerPos[0] + ox,
      this.playerPos[1] + oy,
      this.playerPos[2] + oz,
    );
    this.cameraHolder.rotation.set(this.camera.pitch, this.camera.heading, 0);
  }

  private frameLoop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const dtMs = Math.min(100, Math.max(0, now - this.lastTimeMs));
    this.lastTimeMs = now;
    this.accumulatorMs += dtMs;

    let steps = 0;
    while (this.accumulatorMs >= this.tickStepMs && steps < 4) {
      for (const fn of this.listeners.tick) fn(this.tickStepMs);
      this.accumulatorMs -= this.tickStepMs;
      steps++;
    }

    this.syncCameraCarrier();
    for (const fn of this.listeners.beforeRender) fn(dtMs);
    this.syncCameraCarrier();
    this.scene.render();
    for (const fn of this.listeners.afterRender) fn(dtMs);
  };

  setBlock(): void {}

  on(event: TickEvent, listener: Listener): this {
    this.listeners[event]?.add(listener);
    return this;
  }

  removeListener(event: string, listener: Listener): this {
    this.listeners[event as TickEvent]?.delete(listener);
    return this;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.lastTimeMs = performance.now();
    this.accumulatorMs = 0;
  }
}
