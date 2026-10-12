import { EXTERNAL_SOUNDS, type Cue } from './SoundRegistry.js';
import { settings } from '../config/settings';
// One context, pre-generated buffers and bounded voices. No missing MP3 dependencies.
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Cue, AudioBuffer>();
  private voices = new Set<{
    source: AudioBufferSourceNode;
    owner: string;
    step: boolean;
  }>();
  private abort = new AbortController();
  private active = false;
  private listener = { x: 0, y: 0, z: 0 };
  private volume = 0.65;
  private unlockTask: Promise<void> | null = null;
  constructor() {
    try {
      const value = localStorage.getItem('winterarc-volume');
      if (value !== null) this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    } catch {
      /* optional */
    }
    const unlockFromGesture = (event: Event) => {
      if (event.isTrusted && (!navigator.userActivation || navigator.userActivation.isActive)) void this.startAudio();
    };
    window.addEventListener('click', unlockFromGesture, {
      capture: true,
      signal: this.abort.signal,
    });
    window.addEventListener('touchend', unlockFromGesture, {
      capture: true,
      passive: true,
      signal: this.abort.signal,
    });
    window.addEventListener('keydown', unlockFromGesture, {
      capture: true,
      signal: this.abort.signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.setActive(false);
      },
      { signal: this.abort.signal },
    );
  }
  async unlock(): Promise<void> {
    if (this.context?.state === 'running') {
      return;
    }
    // Chrome only permits creating/resuming Web Audio during an active user gesture.
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    await this.startAudio();
  }
  private startAudio(): Promise<void> {
    if (this.abort.signal.aborted) return Promise.resolve();
    if (this.unlockTask) return this.unlockTask;
    this.unlockTask = this.initializeAudio().finally(() => {
      this.unlockTask = null;
    });
    return this.unlockTask;
  }
  private async initializeAudio(): Promise<void> {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
        for (const kind of [
          'sniper',
          'step',
          'found',
          'throw',
          'hit',
          'break',
          'place',
          'deliver',
          'impact',
        ] as Cue[])
          this.buffers.set(kind, this.synthesize(kind));
        void this.loadExternalSounds();
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch (error) {
      console.warn('Audio initialization:', error);
    }
  }
  get enabled(): boolean {
    return this.active && this.context?.state === 'running';
  }
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.025);
    try {
      localStorage.setItem('winterarc-volume', String(this.volume));
    } catch {
      /* optional */
    }
  }
  setActive(active: boolean): void {
    this.active = active;
    if (!active)
      for (const voice of [...this.voices])
        if (voice.step) {
          voice.source.stop();
          this.voices.delete(voice);
        }
  }
  updateListener(x: number, y: number, z: number, yaw: number, pitch: number): void {
    this.listener = { x, y, z };
    const listener = this.context?.listener;
    if (!listener) return;
    const sx = Math.sin(yaw),
      cx = Math.cos(yaw),
      sy = Math.sin(pitch),
      cy = Math.cos(pitch);
    listener.setPosition(x, y, -z);
    listener.setOrientation(sx * cy, -sy, -cx * cy, sx * sy, cy, -cx * sy);
  }
  playFootstep(owner: string, x: number, y: number, z: number, local = false): void {
    if (this.enabled) this.play('step', local ? undefined : [x, y, z], owner);
  }
  play(kind: Cue, at?: readonly number[], owner = 'effect', preview = false): void {
    const ctx = this.context,
      external = EXTERNAL_SOUNDS[kind],
      buffer = this.buffers.get(kind),
      maxDistance = external?.maxDistance ?? 30;
    if (
      !ctx ||
      ctx.state !== 'running' ||
      !this.master ||
      !buffer ||
      document.hidden ||
      this.voices.size >= 32
    )
      return;
    if (!preview && !this.active) return;
    if (
      at &&
      Math.hypot(at[0] - this.listener.x, at[1] - this.listener.y, at[2] - this.listener.z) > maxDistance
    )
      return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = kind === 'step' ? 0.92 + Math.random() * 0.16 : 1;
    const preferences = settings.get();
    gain.gain.value = (external?.volume ?? 0.65) * (kind === 'step' ? preferences.footstepsVolume : preferences.effectsVolume);
    source.connect(gain);
    let panner: PannerNode | null = null;
    if (at) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2;
      panner.maxDistance = maxDistance;
      panner.rolloffFactor = 1.35;
      panner.positionX.value = at[0];
      panner.positionY.value = at[1];
      panner.positionZ.value = -at[2];
      gain.connect(panner);
      panner.connect(this.master);
    } else gain.connect(this.master);
    const voice = { source, owner, step: kind === 'step' };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.voices.delete(voice);
    };
    source.start();
  }
  stopPlayer(owner: string): void {
    for (const voice of [...this.voices])
      if (voice.owner === owner) {
        voice.source.stop();
        this.voices.delete(voice);
      }
  }
  private async loadExternalSounds(): Promise<void> {
    const context = this.context;
    if (!context) return;
    await Promise.all(
      Object.entries(EXTERNAL_SOUNDS).map(async ([id, definition]) => {
        for (const source of definition.sources) {
          try {
            const response = await fetch(source, { signal: this.abort.signal });
            if (!response.ok) continue;
            const buffer = await context.decodeAudioData(await response.arrayBuffer());
            if (!this.abort.signal.aborted && this.context === context) this.buffers.set(id as Cue, buffer);
            return;
          } catch {
            if (this.abort.signal.aborted) return;
          }
        }
      }),
    );
  }
  private synthesize(kind: Cue): AudioBuffer {
    const ctx = this.context!;
    const duration =
      kind === 'found' || kind === 'deliver' || kind === 'impact'
        ? 0.7
        : kind === 'break'
          ? 0.24
          : 0.15;
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate),
      a = b.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < a.length; i++) {
      const t = i / ctx.sampleRate,
        u = t / duration,
        noise = Math.random() * 2 - 1;
      smooth = smooth * 0.65 + noise * 0.35;
      const attack = Math.min(1, t / 0.004),
        decay = Math.pow(1 - u, 3);
      let sample = 0;
      if (kind === 'found' || kind === 'deliver') {
        const notes = kind === 'found' ? [784, 988, 1175] : [659, 831, 988];
        for (let n = 0; n < notes.length; n++) {
          const tt = t - n * 0.1;
          if (tt >= 0) sample += Math.sin(2 * Math.PI * notes[n] * tt) * Math.exp(-tt * 8) * 0.24;
        }
      } else if (kind === 'step') sample = smooth * 0.7 + Math.sin(2 * Math.PI * 90 * t) * 0.15;
      else if (kind === 'sniper') sample = noise * Math.exp(-t * 42) * .85 + Math.sin(2 * Math.PI * (100 - 45 * u) * t) * .35;
      else if (kind === 'throw') sample = smooth * 0.8;
      else if (kind === 'break')
        sample = noise * 0.55 + Math.sin(2 * Math.PI * (1400 - 900 * u) * t) * 0.2;
      else if (kind === 'impact')
        sample = smooth * 0.5 + Math.sin(2 * Math.PI * (60 - 25 * u) * t) * 0.5;
      else if (kind === 'hit') sample = noise * 0.3 + Math.sin(2 * Math.PI * 120 * t) * 0.5;
      else sample = Math.sin(2 * Math.PI * 180 * t) * 0.5 + smooth * 0.2;
      a[i] = Math.max(
        -0.95,
        Math.min(
          0.95,
          sample *
            attack *
            (kind === 'found' || kind === 'deliver' ? Math.min(1, (1 - u) * 10) : decay),
        ),
      );
    }
    return b;
  }
  dispose(): void {
    this.abort.abort();
    for (const voice of this.voices) voice.source.stop();
    this.voices.clear();
    this.buffers.clear();
    void this.context?.close();
    this.context = null;
  }
}
