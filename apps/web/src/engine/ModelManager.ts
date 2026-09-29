import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshFactory } from './MeshFactory.js';

export class ModelManager {

  constructor(private readonly meshes: MeshFactory) {}


  async loadCrab(parent: TransformNode): Promise<AssetContainer> {
    await import('@babylonjs/loaders');
    const container = await SceneLoader.LoadAssetContainerAsync('/models/', 'frost-crab.glb', this.meshes.scene);
    if (parent.isDisposed()) { container.dispose(); throw new Error('Model owner was disposed'); }
    container.addAllToScene();
    for (const node of container.rootNodes) node.parent = parent;
    for (const mesh of container.meshes) {
      mesh.isPickable = false;
      this.meshes.noa.rendering.addMeshToScene(mesh);
    }
    return container;
  }
}
