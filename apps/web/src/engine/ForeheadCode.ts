import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { MeshFactory } from './MeshFactory';
export class ForeheadCode {
  private readonly plane: Mesh;
  private readonly texture: DynamicTexture;
  private readonly material: StandardMaterial;
  private code = '';
  constructor(head: TransformNode, factory: MeshFactory) {
    const name = `code-${head.name}`;
    this.texture = new DynamicTexture(name, { width: 256, height: 80 }, factory.scene, false);
    this.material = new StandardMaterial(name, factory.scene);
    this.material.diffuseTexture = this.texture;
    this.material.emissiveColor = Color3.White();
    this.material.disableLighting = true;
    this.material.backFaceCulling = true;
    this.plane = CreatePlane(name, { width: .48, height: .15 }, factory.scene);
    this.plane.parent = head;
    this.plane.position.set(0, .13, .29);
    this.plane.rotation.y = Math.PI;
    this.plane.material = this.material;
    this.plane.isPickable = false;
    factory.noa.rendering.addMeshToScene(this.plane);
    this.plane.setEnabled(false);
  }
  setCode(code: string): void {
    this.plane.setEnabled(/^\d{4}$/.test(code));
    if (!code || code === this.code) return;
    this.code = code;
    const c = this.texture.getContext() as CanvasRenderingContext2D;
    c.fillStyle = '#092b3a'; c.fillRect(0, 0, 256, 80);
    c.fillStyle = '#b8fff0'; c.font = 'bold 64px monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(code, 128, 42);
    this.texture.update();
  }
  dispose(): void { this.plane.dispose(); this.material.dispose(); this.texture.dispose(); }
}
