import type { GameSettings } from '../config/settings';
import type { Engine } from './WinterVoxelEngine';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { EYE_HEIGHT } from 'winterarc-gameplay';

export class PlayerCamera {
  private readonly camera: FreeCamera;
  private baseFov: number;

  private bobEnabled = true;
  private shakeEnabled = true;
  private shake = 0;
  impact(): void {
    if (this.shakeEnabled && !this.reducedMotion) this.shake = 0.3;
  }
  private phase = 0;
  private amount = 0;

  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(noa: Engine) {
    this.camera = noa.rendering.getScene().activeCamera as FreeCamera;
    this.baseFov = this.camera.fov;

    noa.ents.getState(noa.camera.cameraTarget, 'followsEntity').offset[1] = EYE_HEIGHT;
  }

  configure(value: GameSettings): void {
    this.baseFov = value.fov * Math.PI / 180;
    this.bobEnabled = value.cameraBob;
    this.shakeEnabled = value.cameraShake;
    if (!this.shakeEnabled) this.shake = 0;
    this.camera.fov = this.baseFov;
  }

  update(dt: number, speed: number, grounded: boolean, active: boolean): void {
    this.shake = Math.max(0, this.shake - dt);
    const target = active && grounded ? Math.min(speed / 6.4, 1) : 0;

    const ease = 1 - Math.exp(-12 * dt);

    this.amount += (target - this.amount) * ease;
    this.phase += dt * (8 + 7 * this.amount);

    const strength = this.reducedMotion || !this.bobEnabled ? 0 : this.amount;

    // Hiệu ứng nhỏ trên camera con, không thay đổi collision của player.
    this.camera.position.x =
      Math.cos(this.phase) * 0.012 * strength + Math.sin(this.shake * 120) * this.shake * 0.13;

    this.camera.position.y =
      Math.sin(this.phase * 2) * 0.018 * strength + Math.cos(this.shake * 100) * this.shake * 0.1;

    this.camera.rotation.z = Math.sin(this.phase) * 0.006 * strength;

    const sprint =
      active && this.bobEnabled && !this.reducedMotion ? Math.max(0, Math.min(1, (speed - 4.3) / 2.1)) : 0;

    this.camera.fov += (this.baseFov + sprint * 0.1 - this.camera.fov) * ease;
  }

  reset(): void {
    this.shake = 0;
    this.phase = 0;
    this.amount = 0;
    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.rotation.z = 0;
    this.camera.fov = this.baseFov;
  }
}
