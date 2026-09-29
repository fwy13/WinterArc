import type { Engine } from 'noa-engine';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { Vec3 } from 'winterarc-core';
export class MeshFactory {
  private readonly materials = new Map<string, StandardMaterial>();
  readonly scene;
  constructor(readonly noa: Engine) {
    this.scene = noa.rendering.getScene();
  }
  material(hex: string, glow = 0): StandardMaterial {
    const key = `${hex}:${glow}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new StandardMaterial(key, this.scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.specularColor = Color3.Black();
      mat.emissiveColor = mat.diffuseColor.scale(glow);
      this.materials.set(key, mat);
    }
    return mat;
  }
  cube(
    parent: TransformNode | null,
    name: string,
    pos: Vec3,
    size: Vec3,
    color: string,
    glow = 0,
  ): Mesh {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
    mesh.parent = parent;
    mesh.position.set(...pos);
    mesh.material = this.material(color, glow);
    mesh.isPickable = false;
    this.noa.rendering.addMeshToScene(mesh);
    return mesh;
  }
}
