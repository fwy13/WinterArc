import { CharacterModel } from './CharacterModel';
import { PROFILE_ROLES, type ProfileRole } from 'winterarc-profile';
import { t } from '../i18n';
import { PlayerNameplate } from './PlayerNameplate';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Engine } from 'noa-engine';
import type { InputCommand, PlayerSnapshot } from 'winterarc-protocol';
import type { Motion } from 'winterarc-core';
import { collides, movePlayer, STEP } from 'winterarc-gameplay';
import type { VoxelWorld } from 'winterarc-world';
import { MeshFactory } from './MeshFactory.js';
import type { AudioManager } from './AudioManager.js';

export { COAT_COLORS } from 'winterarc-profile';
interface Avatar {
  root: TransformNode;
  model: CharacterModel;
  nameplate: PlayerNameplate;
  target: PlayerSnapshot;
  placed: boolean;

  stepDistance: number;
}

export class PlayerManager {
  local: Motion | null = null;
  private pending: InputCommand[] = [];
  private avatars = new Map<string, Avatar>();
  private localStepDistance = 0;
  seq = 0;
  speed = 0;
  constructor(
    private readonly noa: Engine,
    private readonly meshes: MeshFactory,
    private readonly audio: AudioManager,
  ) {}
  reset(session = false): void {
    this.speed = 0;
    this.localStepDistance = 0;
    this.audio.stopPlayer('self');
    this.pending = [];
    this.local = null;
    if (session) this.seq = 0;
    for (const [id, avatar] of this.avatars) {
      avatar.stepDistance = 0;
      avatar.placed = false;
      this.audio.stopPlayer(id);
    }
  }
  reconcile(me: PlayerSnapshot, world: VoxelWorld, frozen: boolean, syncCamera = true): void {
    if (
      this.local &&
      Math.hypot(this.local.x - me.x, this.local.y - me.y, this.local.z - me.z) > 8
    ) {
      this.pending = [];
      this.localStepDistance = 0;
    }
    if (frozen) this.speed = 0;
    this.pending = frozen ? [] : this.pending.filter((c) => c.seq > me.ack);
    this.local = {
      x: me.x,
      y: me.y,
      z: me.z,
      vy: me.vy, vx: me.vx || 0, vz: me.vz || 0,
      yaw: me.yaw,
      pitch: me.pitch,
    };
    for (const cmd of this.pending) movePlayer(this.local, cmd, world);
    // Third-person modes own the camera carrier in their render loop. Network
    // reconciliation must only update the authoritative pose in that case.
    if (syncCamera) this.noa.ents.setPosition(this.noa.playerEntity, [this.local.x, this.local.y, this.local.z]);
  }
  predict(cmd: InputCommand, world: VoxelWorld): void {
    if (!this.local) return;

    this.pending.push(cmd);
    if (this.pending.length > 90) this.pending.shift();

    const { x, z } = this.local;

    movePlayer(this.local, cmd, world);

    // Đo quãng đường thực tế để đứng ép vào tường không tạo hiệu ứng chạy.
    const distance = Math.hypot(this.local.x - x, this.local.z - z);
    this.speed = distance / STEP;
    // Only new predicted movement creates audio; reconciliation replay stays silent.
    const grounded =
      Math.abs(this.local.vy) < 0.1 &&
      collides(world, this.local.x, this.local.y - 0.025, this.local.z);
    if (this.audio.enabled && grounded && this.speed > 0.5 && distance < 0.5) {
      this.localStepDistance += distance;
      if (this.localStepDistance >= 1.65) {
        this.localStepDistance %= 1.65;
        this.audio.playFootstep('self', this.local.x, this.local.y, this.local.z, true);
      }
    } else this.localStepDistance = 0;

    this.noa.ents.setPosition(this.noa.playerEntity, [this.local.x, this.local.y, this.local.z]);
  }
  sync(players: PlayerSnapshot[], self: string, active: boolean): void {
    const keep = new Set<string>();
    for (const p of players) {
      if (p.id === self) continue;
      keep.add(p.id);
      let a = this.avatars.get(p.id);
      if (a && (a.target.color !== p.color || a.target.skinId !== p.skinId)) {
        a.nameplate.dispose();
        a.root.dispose();
        this.avatars.delete(p.id);
        a = undefined;
      }
      if (!a) {
        a = this.create(p);
        this.avatars.set(p.id, a);
      }
      a.target = p;
      const labels = p.roles.filter((role): role is ProfileRole => role !== 'club' && PROFILE_ROLES.includes(role as ProfileRole)).map(role => t(`social.role.${role}`));
      a.nameplate.setName(labels.length ? `${p.name} · ${labels.join(' / ')}` : p.name, p.premium, p.roles.includes('club'));
      const visible = active && !p.observer && p.connected && p.hp > 0 && !p.out;

      a.root.setEnabled(visible);

      if (!visible) {
        a.stepDistance = 0;

        a.placed = false;

        this.audio.stopPlayer(p.id);
      }

      if (visible && !a.placed) {
        a.root.position.set(p.x, p.y, p.z);
        a.placed = true;
      }

      if (!a.placed) {
        a.root.position.set(p.x, p.y, p.z);
        a.placed = true;
      }
    }
    for (const [id, a] of this.avatars)
      if (!keep.has(id)) {
        this.audio.stopPlayer(id);
        a.nameplate.dispose();
        a.root.dispose();
        this.avatars.delete(id);
      }
  }
  render(dt: number, time: number, world: VoxelWorld): void {
    const stride = 1.65;
    for (const [id, avatar] of this.avatars) {
      const target = avatar.target;
      const position = avatar.root.position;

      if (!avatar.root.isEnabled()) {
        avatar.stepDistance = 0;
        continue;
      }

      const gap = Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z);

      if (gap > 3) {
        position.set(target.x, target.y, target.z);
        avatar.stepDistance = 0;
        this.audio.stopPlayer(id);
        continue;
      }

      const beforeX = position.x;
      const beforeZ = position.z;
      const rate = 1 - Math.exp(-13 * dt);

      position.x += (target.x - position.x) * rate;
      position.y += (target.y - position.y) * rate;
      position.z += (target.z - position.z) * rate;

      avatar.root.rotation.y +=
        (((target.yaw - avatar.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * rate;

      const distance = Math.hypot(position.x - beforeX, position.z - beforeZ);

      const speed = distance / Math.max(dt, 0.0001);

      const grounded =
        Math.abs(target.vy) < 0.1 && collides(world, target.x, target.y - 0.025, target.z);

      const walking = grounded && speed > 0.5;

      avatar.model.animate(dt, time, speed, grounded, target.pitch);

      if (!this.audio.enabled || !walking || speed > 9) {
        avatar.stepDistance = 0;
        continue;
      }

      avatar.stepDistance += distance;
      if (avatar.stepDistance >= stride) {
        avatar.stepDistance %= stride;
        this.audio.playFootstep(id, position.x, position.y + 0.1, position.z);
      }
    }
  }
  private create(p: PlayerSnapshot): Avatar {
    const model = new CharacterModel(this.meshes, p.id, p.skinId || 'explorer', p.color);
    const root = model.root;
    return {
      root,
      model,
      nameplate: new PlayerNameplate(root, this.meshes, p.name),
      target: p,
      placed: false,
      stepDistance: 0,
    };
  }
  dispose(): void {
    for (const [id, avatar] of this.avatars) {
      this.audio.stopPlayer(id);
      avatar.nameplate.dispose();
      avatar.root.dispose();
    }

    this.avatars.clear();
    this.reset(true);
  }
}
