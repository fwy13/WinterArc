import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { avatarParts, AVATAR_PIVOTS, type BodyGroup } from 'winterarc-profile';
import type { MeshFactory } from './MeshFactory';

/** Articulated voxel character. Geometry/materials only; physics stays server-defined. */
export class CharacterModel {
  readonly root: TransformNode;
  private readonly visual: TransformNode;
  private readonly joints: Record<BodyGroup, TransformNode>;
  private stride = 0;
  constructor(factory: MeshFactory, id: string, skinId: string, color: number) {
    this.root = new TransformNode(`player-${id}`, factory.scene);
    this.visual = new TransformNode(`character-${id}`, factory.scene);
    this.visual.parent = this.root;
    this.joints = {} as Record<BodyGroup, TransformNode>;
    for (const group of Object.keys(AVATAR_PIVOTS) as BodyGroup[]) {
      const joint = new TransformNode(`${id}-${group}`, factory.scene);
      joint.parent = this.visual;
      joint.position.set(...AVATAR_PIVOTS[group]);
      this.joints[group] = joint;
    }
    for (const part of avatarParts(skinId, color)) {
      factory.cube(this.joints[part.group], `${id}-${part.name}`, part.position, part.size, part.color);
    }
  }
  animate(dt: number, time: number, speed: number, grounded: boolean, pitch: number): void {
    const moving = grounded && speed > .5 && speed < 12;
    this.stride += moving ? dt * Math.min(speed * 2.2, 14) : 0;
    const swing = moving ? Math.sin(this.stride) * .65 : 0;
    const blend = 1 - Math.exp(-14 * dt);
    const pose = (group: BodyGroup, target: number) => {
      this.joints[group].rotation.x += (target - this.joints[group].rotation.x) * blend;
    };
    pose('leftArm', grounded ? -swing : -.55);
    pose('rightArm', grounded ? swing : -.55);
    pose('leftLeg', grounded ? swing : .3);
    pose('rightLeg', grounded ? -swing : -.25);
    pose('head', Math.max(-.35, Math.min(.35, pitch)));
    this.visual.position.y = moving ? Math.abs(Math.sin(this.stride)) * .035 : Math.sin(time * 2) * .008;
    this.visual.rotation.z = moving ? Math.sin(this.stride) * .025 : 0;
  }
}
