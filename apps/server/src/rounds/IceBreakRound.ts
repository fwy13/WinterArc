import { aimIce } from 'winterarc-gameplay';
import { BLOCK, ICE_BREAK } from 'winterarc-world';
import type { RoundContext, RoundController } from './RoundContext.js';
export class IceBreakRound implements RoundController {
  private ring: number = ICE_BREAK.radius;
  private shrinkAt = 15;
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    this.context.state.iceRadius = this.ring;
    this.context.state.iceShrinkIn = this.shrinkAt;
  }
  attack(id: string): void {
    const { state, world } = this.context;
    const p = state.players.get(id);
    if (!p) return;
    const aim = aimIce(p, world);
    if (aim.block) {
      const { x, y, z } = aim.block;
      world.set(x, y, z, BLOCK.AIR);
      state.brokenIce.push(`${x}:${z}`);
      p.score++;
    }
    this.context.shot({ from: aim.from, to: aim.to, hit: !!aim.block, playerId: id });
  }
  update(): void {
    const { state, world } = this.context;
    const minimumRadius = state.format === 'squad' || state.entrants === 1 ? 6 : 0;
    state.iceShrinkIn = this.ring <= minimumRadius ? 0 : Math.max(0, this.shrinkAt - state.elapsed);
    // Shrink from the outside so the final cannot remain a permanent stalemate.
    if (this.ring > minimumRadius && state.elapsed >= this.shrinkAt) {
      this.shrinkAt += 6;
      this.ring = Math.max(minimumRadius, this.ring - 1.5);
      state.iceRadius = this.ring;
      this.context.sound('break', [0, ICE_BREAK.floorY, 0]);
      for (let x = -18; x <= 18; x++)
        for (let z = -18; z <= 18; z++) {
          if (
            Math.hypot(x + 0.5, z + 0.5) >= this.ring &&
            world.get(x, ICE_BREAK.floorY, z) === BLOCK.ICE
          ) {
            world.set(x, ICE_BREAK.floorY, z, BLOCK.AIR);
            state.brokenIce.push(`${x}:${z}`);
          }
        }
    }
    for (const [id, p] of this.context.alive())
      if (p.y <= ICE_BREAK.loseY) this.context.eliminate(id);
    const survivors = this.context.alive().length;
    // Solo practice lasts until falling or timeout. Co-op aims to survive the timer.
    if (survivors === 0 || (state.format === 'solo' && state.entrants > 1 && survivors === 1)) {
      this.context.complete('survivors');
    }
  }
}
