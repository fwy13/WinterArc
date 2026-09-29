declare module 'noa-engine' {
  import type { Scene } from '@babylonjs/core/scene.js';
  import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
  import type { Engine as BabylonEngine } from '@babylonjs/core/Engines/engine.js';
  export interface ChunkArray {
    shape: number[];
    set(x: number, y: number, z: number, id: number): void;
  }
  export class Engine {
    constructor(options: Record<string, unknown>);
    playerEntity: number;
    setBlock(id: number, x: number, y: number, z: number): void;
    worldName: string;
    maxRenderRate: number;
    container: {
      canvas: HTMLCanvasElement;
      element: HTMLElement;
      hasPointerLock: boolean;
      setPointerLock(lock: boolean): void;
    };
    camera: {
      cameraTarget: number;
      heading: number;
      pitch: number;
      sensitivityX: number;
      sensitivityY: number;
      sensitivityMult: number;
    };
    ents: {
      getState(id: number, name: 'followsEntity'): { offset: number[] };
      removeComponent(id: number, name: string): void;
      setPosition(id: number, position: number[]): void;
      getPosition(id: number): number[];
    };
    registry: {
      registerMaterial(
        name: string,
        options: {
          color?: number[];
          textureURL?: string;
          texHasAlpha?: boolean;
        },
      ): void;
      registerBlock(
        id: number,
        options: {
          material?: string | string[];
          solid?: boolean;
          opaque?: boolean;
        },
      ): void;
    };
    rendering: {
      getScene(): Scene;
      engine: BabylonEngine;
      addMeshToScene(mesh: AbstractMesh, isStatic?: boolean): void;
    };
    world: {
      on(
        event: 'worldDataNeeded',
        listener: (
          id: string,
          array: ChunkArray,
          x: number,
          y: number,
          z: number,
          worldName: string,
        ) => void,
      ): void;
      setChunkData(id: string, array: ChunkArray): void;
      playerChunkLoaded: boolean;
    };
    on(event: 'tick' | 'beforeRender' | 'afterRender', listener: (dt: number) => void): this;
    removeListener(event: string, listener: (dt: number) => void): this;
    setPaused(paused: boolean): void;
  }
}
