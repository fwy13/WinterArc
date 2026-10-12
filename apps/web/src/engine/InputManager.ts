import { duelControls, selectDuelPose } from './WallDuelInput';
import { knockoutControls, knockoutPower, adjustKnockoutPower } from './KnockoutInput';
import { settings } from '../config/settings';
import { touchInput, clearTouchInput } from './TouchInput';
import type { Engine } from 'noa-engine';
import type { InputCommand } from 'winterarc-protocol';
export class InputManager {
  private keys = new Set<string>();
  private mouseDown = false;
  private abort = new AbortController();
  enabled = false;
  onInteract: () => void = () => {};
  onPause: () => void = () => {};
  constructor(private readonly noa: Engine) {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        )
          return;
        if (e.code === 'Escape') {
          this.onPause();
          return;
        }
        if (!this.enabled) return;
        if (duelControls.hider && ['Digit1','Digit2','Digit3'].includes(e.code)) {
          e.preventDefault();selectDuelPose(Number(e.code.slice(-1))-1);return;
        }
        if (knockoutControls.enabled && (e.code === 'KeyQ' || e.code === 'KeyE')) {
          e.preventDefault(); if (!e.repeat) adjustKnockoutPower(knockoutPower.get() + (e.code === 'KeyE' ? 1 : -1)); return;
        }
        if (
          [
            'KeyW',
            'KeyA',
            'KeyS',
            'KeyD',
            'Space',
            'ShiftLeft',
            'ShiftRight',
            'KeyE',
            'KeyF',
          ].includes(e.code)
        )
          e.preventDefault();
        this.keys.add(e.code);
        if (e.code === 'KeyE' && !e.repeat) this.onInteract();
      },
      options,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), options);
    noa.container.element.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse' && e.button === 0 && this.enabled) {
          this.mouseDown = true;
          noa.container.setPointerLock(true);
        }
      },
      options,
    );
    noa.container.element.addEventListener('contextmenu', (e) => e.preventDefault(), options);
    window.addEventListener(
      'pointerup',
      () => {
        this.mouseDown = false;
      },
      options,
    );
    window.addEventListener(
      'blur',
      () => {
        this.clear();
        this.onPause();
      },
      options,
    );
    document.addEventListener(
      'pointerlockchange',
      () => {
        if (!document.pointerLockElement && this.enabled) this.onPause();
      },
      options,
    );
  }
  get attacking(): boolean {
    return this.enabled && (this.mouseDown || this.keys.has('KeyF') || touchInput.attack);
  }
  updateTouchLook(): void {
    const { lookX, lookY } = touchInput;
    touchInput.lookX = touchInput.lookY = 0;
    if (!this.enabled) return;
    const yaw = this.noa.camera.heading + lookX * 0.004 * settings.get().touchSensitivity;
    this.noa.camera.heading =
      ((((yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    this.noa.camera.pitch = Math.max(-1.5, Math.min(1.5, this.noa.camera.pitch + lookY * 0.004 * settings.get().touchSensitivity));
  }
  sample(seq: number, round: number): InputCommand {
    this.updateTouchLook();
    if (touchInput.interact) {
      touchInput.interact = false;
      if (this.enabled) this.onInteract();
    }
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    return {
      seq,
      round,
      forward: this.enabled
        ? clamp(Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) + touchInput.forward)
        : 0,
      side: this.enabled
        ? clamp(Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + touchInput.side)
        : 0,
      jump: this.enabled && (this.keys.has('Space') || touchInput.jump),
      sprint:
        this.enabled &&
        (this.keys.has('ShiftLeft') ||
          this.keys.has('ShiftRight') ||
          Math.hypot(touchInput.forward, touchInput.side) > 0.85),
      yaw: this.noa.camera.heading,
      pitch: this.noa.camera.pitch,
    };
  }
  clear(): void {
    duelControls.fireRequested=false;
    clearTouchInput();
    this.keys.clear();
    this.mouseDown = false;
  }
  dispose(): void {
    this.abort.abort();
    this.clear();
  }
}
