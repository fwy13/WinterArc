import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { MeshFactory } from './MeshFactory';

export class PlayerNameplate {
  private readonly mesh: Mesh;
  private readonly texture: DynamicTexture;
  private readonly material: StandardMaterial;
  private text = '';
  private premium = false;

  constructor(parent: TransformNode, factory: MeshFactory, name: string) {
    const id = `name-${parent.name}`;
    this.texture = new DynamicTexture(id, { width: 512, height: 96 }, factory.scene, false);
    this.texture.hasAlpha = true;
    this.material = new StandardMaterial(id, factory.scene);
    this.material.diffuseTexture = this.texture;
    this.material.emissiveColor = Color3.White();
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.material.useAlphaFromDiffuseTexture = true;
    this.mesh = CreatePlane(id, { width: 2.8, height: 0.525 }, factory.scene);
    this.mesh.parent = parent;
    this.mesh.position.y = 2.3;
    this.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.mesh.isPickable = false;
    this.mesh.material = this.material;
    // Keep normal depth testing: names cannot reveal players through walls.
    factory.noa.rendering.addMeshToScene(this.mesh);
    this.setName(name);
  }

  setName(name: string, premium = false): void {
    if (name === this.text && premium === this.premium) return;
    this.text = name;
    this.premium = premium;
    // This web renderer uses a browser 2D canvas. Babylon's portable
    // ICanvasRenderingContext omits textAlign even though both browser contexts support it.
    const context = this.texture.getContext() as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    context.clearRect(0, 0, 512, 96);
    context.fillStyle = 'rgba(15, 23, 42, 0.2)';
    context.fillRect(0, 0, 512, 96);
    context.font = '600 40px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = premium ? '#ffd45c' : '#ecfdf5';
    context.fillText(premium ? `★ ${name}` : name, 256, 48, 480);
    this.texture.update();
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
