import { COLOR_FLOOR, randomFromSeed, updateColorFloor } from 'winterarc-world';
import type { RoundContext, RoundController } from './RoundContext.js';
export class ColorFallRound implements RoundController {
  private random = Math.random;
  private nextChange = 0;
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    this.random = randomFromSeed(this.context.state.seed);
    this.context.state.floorCycle = 0;
    this.choose();
  }
  private choose(): void {
    const { state, world } = this.context;
    state.floorDropped = false;
    const choices = COLOR_FLOOR.blocks.filter(block => block !== state.floorSafeBlock);
    state.floorSafeBlock = choices[Math.floor(this.random() * choices.length)];
    state.floorRemaining = Math.max(3.2, 7.5 - state.floorCycle * 0.4);
    this.nextChange = state.elapsed + state.floorRemaining;
    updateColorFloor(world, state.floorCycle, state.floorSafeBlock, false);
  }
  update(): void {
    const { state, world } = this.context;
    for (const [id, p] of this.context.alive()) {
      if (p.y < 3) this.context.eliminate(id);
      else p.score = state.floorCycle;
    }
    const survivors = this.context.alive().length;
    // Solo practice lasts until falling or timeout. Co-op aims to survive the timer.
    if (survivors === 0 || (state.format === 'solo' && state.entrants > 1 && survivors === 1)) {
      this.context.complete('survivors');
      return;
    }
    state.floorRemaining = Math.max(0, this.nextChange - state.elapsed);
    if (state.elapsed < this.nextChange) return;
    if (!state.floorDropped) {
      state.floorDropped = true;
      updateColorFloor(world, state.floorCycle, state.floorSafeBlock, true);
      this.nextChange = state.elapsed + 2.6;
      this.context.sound('break', [0, 8, 0]);
    } else {
      state.floorCycle++;
      this.choose();
    }
  }
}
