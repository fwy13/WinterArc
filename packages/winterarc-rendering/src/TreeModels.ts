import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/loaders/glTF/index.js';
export class TreeModels {
  private loading?: Promise<AssetContainer>;
  private container?: AssetContainer;
  private disposed = false;
  constructor(
    private scene: Scene,
    private register?: (mesh: AbstractMesh) => void,
  ) {}
  async populate(
    trees: readonly { x: number; y: number; z: number; scale: number }[],
    parent: TransformNode,
  ): Promise<void> {
    if (!trees.length) return;
    try {
      this.loading ??= SceneLoader.LoadAssetContainerAsync(
        '/models/',
        'christmas-pine.glb',
        this.scene,
      ).then((c) => {
        if (this.disposed) {
          c.dispose();
          throw new Error('Tree owner disposed');
        }
        this.container = c;
        return c;
      });
      const container = await this.loading;
      if (this.disposed || parent.isDisposed()) return;
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        const instance = container.instantiateModelsToScene((name) => `pine-${i}-${name}`, false, {
          doNotInstantiate: false,
        });
        for (const root of instance.rootNodes) {
          root.parent = parent;
          root.position.set(t.x, t.y, t.z);
          root.scaling.setAll(t.scale);
          for (const mesh of root.getChildMeshes()) {
            mesh.isPickable = false;
            this.register?.(mesh);
          }
        }
      }
    } catch (error) {
      if (!this.disposed) console.warn('Tree asset:', error);
    }
  }
  dispose(): void {
    this.disposed = true;
    this.container?.dispose();
  }
}
