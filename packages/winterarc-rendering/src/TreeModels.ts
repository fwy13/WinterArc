import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
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
        // Imported rootNodes have the base Node type. Place the whole model
        // under a TransformNode, preserving each GLB root's authored transform.
        const placement = new TransformNode(`pine-placement-${i}`, this.scene);
        placement.parent = parent;
        placement.position.set(t.x, t.y, t.z);
        placement.scaling.setAll(t.scale);
        for (const root of instance.rootNodes) root.parent = placement;
        for (const mesh of placement.getChildMeshes()) {
          mesh.isPickable = false;
          this.register?.(mesh);
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
