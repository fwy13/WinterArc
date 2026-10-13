import { codeEpoch } from 'winterarc-gameplay';
import { bindRenderResolution } from './RenderResolution';
import { duelControls, duelPose } from './WallDuelInput';
import { knockoutPower } from './KnockoutInput';
import { AuroraSky } from 'winterarc-rendering';
import { SpectatorCamera } from './SpectatorCamera';
import type { SpectatorOptions } from '../components/SpectatorControls';
import { settings, type GameSettings } from '../config/settings';
import { renderFps } from './RenderStats';
import { Engine } from 'noa-engine';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Scene } from '@babylonjs/core/scene.js';
import { type GameId } from 'winterarc-core';
import { type InputCommand, type Snapshot, type ShotEvent, type SoundEvent } from 'winterarc-protocol';
import { MeshFactory } from './MeshFactory.js';
import { TextureManager } from './TextureManager.js';
import { MapManager } from './MapManager.js';
import { PlayerManager } from './PlayerManager.js';
import { hasTouchControls } from './TouchInput';
import { InputManager } from './InputManager.js';
import { EffectsManager } from './EffectsManager.js';
import { ModelManager } from './ModelManager.js';
import { GameRegistry } from '../games/GameRegistry.js';
import type { GameMode, ModeContext } from '../games/GameMode.js';

import { EYE_HEIGHT, PLAYER_HEIGHT, collides } from 'winterarc-gameplay';
import { PlayerCamera } from './PlayerCamera';
import { AudioManager } from './AudioManager.js';

export interface EngineCallbacks {
  input: (command: InputCommand) => void;
  attack: () => void;

  find: (id: string) => void;
  pause: () => void;
  candidate: (visible: boolean) => void;
  ready: () => void;
  notice: (message: string) => void;
}
/** One noa instance for the application; changing a game replaces only its world and mode. */
export class GameEngine {
  private readonly sky: AuroraSky;
  private readonly resolution: ReturnType<typeof bindRenderResolution>;
  readonly noa: Engine;
  readonly map: MapManager;
  readonly players: PlayerManager;
  private readonly input: InputManager;
  private readonly effects: EffectsManager;
  private readonly context: ModeContext;
  private mode: GameMode;
  private spectator = new SpectatorCamera();
  setSpectator(value: SpectatorOptions): void { this.spectator.configure(value); }
  private snapshot: Snapshot | null = null;
  private paused = true;
  private online = false;
  private initialized = false;
  private visible = true;
  private target: string | null = null;
  private lastFrame = performance.now();
  private attackAt = 0;
  private statsAt = 0;
  private unsubscribeSettings: () => void = () => {};

  private heard = new Set<string>();
  private readonly playerCamera: PlayerCamera;
  private readonly audio: AudioManager;

  constructor(
    element: HTMLElement,
    private readonly callbacks: EngineCallbacks,
  ) {
    this.noa = new Engine({
      domElement: element,
      debug: false,
      silent: true,
      silentBabylon: true,
      playerStart: [-14, 15, -36],
      playerHeight: PLAYER_HEIGHT,
      playerWidth: 0.58,
      playerShadowComponent: false,
      stickyPointerLock: false,
      dragCameraOutsidePointerLock: false,
      skipDefaultHighlighting: true,
      originRebaseDistance: 1000000,
      chunkSize: 24,
      chunkAddDistance: [4, 2],
      chunkRemoveDistance: [5, 3],
      worldGenWhilePaused: true,
      tickRate: 30,
      maxRenderRate: 60,
      antiAlias: true,
      clearColor: [0.105, 0.19, 0.25],
      ambientColor: [0.64, 0.75, 0.79],
      lightDiffuse: [0.78, 0.88, 1],
      lightSpecular: [0, 0, 0],
      lightVector: [0.6, -1, 0.35],
      useAO: true,
      AOmultipliers: [0.92, 0.79, 0.63],
      preserveDrawingBuffer: false,
    });
    const noa = this.noa;
    for (const name of [
      'receivesInputs',
      'movement',
      'collideTerrain',
      'collideEntities',
      'physics',
    ])
      noa.ents.removeComponent(noa.playerEntity, name);
    noa.camera.sensitivityX = 7;
    noa.camera.sensitivityY = 7;
    const scene = noa.rendering.getScene();
    this.sky = new AuroraSky(scene, settings.get().skyQuality, mesh => noa.rendering.addMeshToScene(mesh, false));
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 48;
    scene.fogEnd = 113;
    scene.fogColor = new Color3(0.105, 0.19, 0.25);
    const fill = new HemisphericLight('winter-fill', new Vector3(0, 1, 0), scene);
    fill.intensity = 0.7;
    fill.groundColor = new Color3(0.19, 0.3, 0.35);
    new TextureManager().register(noa);
    const meshes = new MeshFactory(noa);
    this.map = new MapManager(noa, meshes);

    this.audio = new AudioManager();
    const models = new ModelManager(meshes);
    this.players = new PlayerManager(noa, meshes, this.audio);

    this.playerCamera = new PlayerCamera(noa);
    this.effects = new EffectsManager(meshes);
    this.input = new InputManager(noa);
    this.input.onPause = callbacks.pause;
    this.input.onInteract = () => {
      if (this.target && this.input.enabled) callbacks.find(this.target);
    };
    this.context = {
      noa,
      meshes,
      map: this.map,
      models,
      effects: this.effects,
      notice: callbacks.notice,
    };
    this.resolution = bindRenderResolution(noa.rendering.engine, () => settings.get().renderScale);
    this.applySettings(settings.get());
    this.unsubscribeSettings = settings.subscribe(() => this.applySettings(settings.get()));
    this.mode = GameRegistry.create('hunt', this.context);
    this.preview();
    noa.on('tick', this.tick);
    noa.on('beforeRender', this.render);
  }
  select(id: GameId, force = false): void {
    if (this.mode.id !== id || force) {
      this.mode.dispose();
      this.effects.clear();
      this.map.switchTo(id, force);
      this.mode = GameRegistry.create(id, this.context);
      this.mode.sync(null);
    }
    if (!this.snapshot) this.preview();
  }
  private preview(): void {
    if(this.mode.id === 'wallduel') {
      this.noa.ents.setPosition(this.noa.playerEntity,[9,10,-16]);this.noa.camera.heading=-.45;this.noa.camera.pitch=.35;return;
    }
    const crab = this.mode.id === 'crab';
    this.noa.ents.setPosition(this.noa.playerEntity, crab ? [13, 12, -23] : [-14, 15, -36]);
    this.noa.camera.heading = crab ? -0.5 : 0.35;
    this.noa.camera.pitch = crab ? 0.28 : 0.26;
  }
  sync(snapshot: Snapshot | null): void {
    const before = this.snapshot;
    this.snapshot = snapshot;
    if (!snapshot) {
      this.players.dispose();
      this.playerCamera.reset();
      this.mode.sync(null);
      this.effects.clear();
      this.preview();
      this.setPaused(true);
      return;
    }
    this.select(
      snapshot.mode,
      before?.round !== snapshot.round || before?.roomId !== snapshot.roomId,
    );
    this.mode.sync(snapshot);
    const session = before?.selfId !== snapshot.selfId;
    const reset = session || before?.round !== snapshot.round;
    if (reset) {
      this.heard.clear();

      this.players.reset(session);
      this.playerCamera.reset();
      this.effects.clear();
      this.noa.camera.heading = 0;
      this.noa.camera.pitch = snapshot.mode === 'knockout' ? .65 : 0;
    }
    if (snapshot.mode === 'codehunt' && before?.codeHunt.turn !== snapshot.codeHunt.turn) { this.players.reset(); this.input.clear(); this.playerCamera.reset(); this.noa.camera.heading=0; this.noa.camera.pitch=0; }
    const me = snapshot.players.find((p) => p.id === snapshot.selfId),
      active = snapshot.phase !== 'lobby';

    if (me && active && !me.out && !me.qualified)
      this.players.reconcile(
        me,
        this.map.world,
        (snapshot.mode === 'codehunt' && snapshot.codeHunt.stage === 'break') || snapshot.mode === 'wallduel' || snapshot.mode === 'knockout' || snapshot.phase !== 'playing' || me.hp <= 0 || me.out || me.qualified,
        snapshot.mode !== 'knockout' && snapshot.mode !== 'wallduel',
      );
    else if (!active) this.preview();
    this.players.sync(snapshot.mode === 'wallduel' ? [] : snapshot.players, snapshot.selfId, active, snapshot.mode === 'codehunt' && snapshot.phase === 'playing' && snapshot.codeHunt.stage === 'hunt' && snapshot.codeView?.turn === snapshot.codeHunt.turn && snapshot.codeView.epoch === codeEpoch(snapshot.elapsed-snapshot.codeHunt.startedAt) ? snapshot.codeView : undefined);
    this.refreshInput();
    if (before?.phase !== snapshot.phase && snapshot.phase !== 'playing') this.setPaused(true);
  }
  setOnline(online: boolean): void {
    if (this.online && !online) {
      this.players.reset();
      this.input.clear();
    }
    this.online = online;
    this.refreshInput();
  }
  setPaused(paused: boolean, lock = false): void {
    this.paused = paused;
    this.input.clear();
    this.refreshInput();
    if (paused) this.audio.setActive(false);
    if (lock && !paused && !hasTouchControls()) this.noa.container.setPointerLock(true);
    else if (paused) this.noa.container.setPointerLock(false);
  }
  setVisible(visible: boolean): void {
    if (!visible) this.audio.setActive(false);
    if (!this.initialized || this.visible === visible) return;
    this.visible = visible;
    this.noa.setPaused(!visible);
    this.lastFrame = performance.now();

    if (!visible) this.playerCamera.reset();
  }
  private refreshInput(): void {
    const s = this.snapshot,
      me = s?.players.find((p) => p.id === s.selfId);
    this.input.enabled = !!(
      this.online &&
      !this.paused &&
      s?.phase === 'playing' &&
      !(s.mode === 'codehunt' && s.codeHunt.stage === 'break') &&
      me &&
      !me.observer &&
      me.hp > 0 &&
      !me.out &&
      !me.qualified
    );
    this.noa.camera.sensitivityMult = this.input.enabled ? 1 : 0;
  }
  private applySettings(value: GameSettings): void {
    this.sky.setQuality(value.skyQuality);
    this.noa.camera.sensitivityX = value.mouseSensitivity;
    this.noa.camera.sensitivityY = value.mouseSensitivity;
    this.audio.setVolume(value.volume);
    this.playerCamera.configure(value);
    this.resolution.refresh();
  }
  setAudioVolume(value: number): void {
    this.audio.setVolume(value);
  }
  async previewAudio(): Promise<void> {
    await this.audio.unlock();
    this.audio.play('found', undefined, 'preview', true);
  }
  found(): void {
    this.audio.play('found');
  }
  sound(event: SoundEvent): void {
    if (this.heard.has(event.id)) return;
    this.heard.add(event.id);
    if (this.heard.size > 256) this.heard.delete(this.heard.values().next().value!);
    if (event.kind === 'impact' && this.snapshot?.mode === 'crab') this.playerCamera.impact();
    this.audio.play(event.kind, event.at, event.playerId);
  }
  shot(event: ShotEvent): void {
    this.mode.onShot(event);
    this.audio.play(this.mode.id === 'wallduel' ? 'sniper' : 'throw', event.from, event.playerId);
    if (event.hit) this.audio.play(this.mode.id === 'icebreak' ? 'break' : 'hit', event.to, event.playerId);
  }
  private tick = (): void => {
    if (!this.initialized && this.map.chunks > 14) {
      this.initialized = true;
      this.callbacks.ready();
    }
    if (!this.online || !this.snapshot || this.snapshot.phase !== 'playing') return;
    if (this.snapshot.players.find(p => p.id === this.snapshot?.selfId)?.observer) return;
    const cmd = this.input.sample(this.players.seq++, this.snapshot.round);
    if (this.mode.id === 'knockout') {
      cmd.forward = cmd.side = 0; cmd.jump = cmd.sprint = false;
      cmd.knockoutPower = knockoutPower.get(); cmd.knockoutTurn = this.snapshot.knockout.turn;
    }
    if (this.mode.id === 'wallduel') {
      cmd.duelTurn=this.snapshot.duel.turn;cmd.duelPose=duelPose.get();cmd.duelFire=this.input.attacking || (this.input.enabled && duelControls.fireRequested);duelControls.fireRequested=false;
      cmd.jump=cmd.sprint=false;cmd.forward=0;
      if(this.snapshot.selfId===this.snapshot.duel.hunterId)cmd.side=0;
    }
    this.callbacks.input(cmd);
    const me = this.snapshot.players.find((p) => p.id === this.snapshot?.selfId);
    if (!(this.mode.id === 'codehunt' && this.snapshot.codeHunt.stage === 'break') && this.mode.id !== 'knockout' && this.mode.id !== 'wallduel' && me && me.hp > 0 && !me.out && !me.qualified) this.players.predict(cmd, this.map.world);
    if (
      (this.mode.id === 'crab' || this.mode.id === 'icebreak') &&
      this.input.attacking &&
      performance.now() - this.attackAt >=
        (this.mode.id === 'crab' ? 440 : 360)
    ) {
      this.attackAt = performance.now();

      this.callbacks.attack();
    }
  };
  private render = (): void => {
    const now = performance.now(),
      dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (now - this.statsAt >= 500) { this.statsAt = now; renderFps.set(Math.round(this.noa.rendering.engine.getFps())); }
    this.input.updateTouchLook();
    const p = this.players.local;

    const grounded = !!p && Math.abs(p.vy) < 0.1 && collides(this.map.world, p.x, p.y - 0.025, p.z);

    this.playerCamera.update(dt, this.players.speed, grounded, this.input.enabled);
    const canHear =
      this.online && !this.paused && this.snapshot?.phase === 'playing' && !document.hidden;
    this.audio.setActive(canHear);

    if (canHear) {
      const [x, y, z] = this.noa.ents.getPosition(this.noa.playerEntity);
      this.audio.updateListener(
        x,
        y + EYE_HEIGHT,
        z,
        this.noa.camera.heading,
        this.noa.camera.pitch,
      );
    }

    this.spectator.update(this.noa, this.snapshot, dt);
    this.players.render(dt, now / 1000, this.map.world);
    this.mode.render(dt, now / 1000);
    this.effects.render(dt, now / 1000);
    const target =
      this.input.enabled && this.players.local ? this.mode.interaction(this.players.local) : null;
    if (target !== this.target) {
      this.target = target;
      this.callbacks.candidate(!!target);
    }
  };
  dispose(): void {
    this.sky.dispose();
    this.unsubscribeSettings();
    this.resolution.dispose();
    this.input.dispose();
    this.mode.dispose();
    this.players.dispose();
    this.effects.dispose();
    this.map.dispose();

    this.audio.dispose();
    this.noa.removeListener('tick', this.tick);
    this.noa.removeListener('beforeRender', this.render);
    this.noa.setPaused(true);
    this.noa.rendering.getScene().dispose();
    renderFps.set(0);
    this.noa.rendering.engine.dispose();
  }
}
