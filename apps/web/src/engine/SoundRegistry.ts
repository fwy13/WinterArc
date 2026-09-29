import type { SoundKind } from 'winterarc-protocol';
export type Cue = SoundKind | 'step';
export interface SoundDefinition {
  sources: readonly string[];
  volume: number;
  maxDistance: number;
}
const sound = (name: string, volume: number, maxDistance = 30): SoundDefinition => ({
  sources: [`/audio/${name}.wav`, `/audio/${name}.mp3`], volume, maxDistance,
});
/** Files are optional; every cue has a cached synthesized fallback. */
export const EXTERNAL_SOUNDS: Record<Cue, SoundDefinition> = {
  step: sound('player/step', 0.55),
  found: sound('events/found', 0.65),
  throw: sound('events/snowball', 0.5),
  hit: sound('events/hit', 0.65),
  break: sound('events/break', 0.65),
  place: sound('events/place', 0.5),
  deliver: sound('events/checkpoint', 0.65),
  impact: sound('events/crab-slam', 0.75, 65),
};
