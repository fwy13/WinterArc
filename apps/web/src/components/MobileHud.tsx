import type { Snapshot } from 'winterarc-protocol';
import { HudLayout } from './GameHud';
/** Compatibility entry point. Desktop and touch now share the same HUD state. */
export default function MobileHud({ state, candidate = false }: { state: Snapshot; candidate?: boolean }) {
  return <HudLayout state={state} candidate={candidate} touch />;
}
