import { randomInt } from 'node:crypto';
import { canReadCode, codeEpoch, CODE_HUNT } from 'winterarc-gameplay';
import type { RoundContext, RoundController } from './RoundContext.js';
export class CodeHuntRound implements RoundController {
  // Secrets intentionally never enter the shared Colyseus schema or seeded world.
  private readonly codes = new Map<string, string>();
  private readonly nextGuess = new Map<string, number>();
  private epoch = -1;
  private nextView = 0;
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    this.codes.clear(); this.nextGuess.clear(); this.epoch = -1; this.nextView = 0;
  }
  private rotate(): void {
    const epoch = codeEpoch(this.context.state.elapsed);
    if (epoch === this.epoch) return;
    this.epoch = epoch;
    // Do not immediately reuse any previous code, even for a different player.
    const used = new Set(this.codes.values());
    this.codes.clear();
    for (const [id] of this.context.alive()) {
      let code: string;
      do { code = String(randomInt(10000)).padStart(4, '0'); } while (used.has(code));
      used.add(code); this.codes.set(id, code);
    }
  }
  update(): void {
    const { state, world } = this.context;
    this.rotate();
    for (const [id, p] of this.context.alive()) {
      if (p.y <= world.loseY) this.context.eliminate(id);
    }
    const alive = this.context.alive();
    if (alive.length <= 1) { this.context.complete('last-standing'); return; }
    if (state.elapsed < this.nextView) return;
    this.nextView = state.elapsed + .1;
    for (const [id, viewer] of state.players) {
      if (!viewer.connected) continue;
      const visible = !viewer.out && !viewer.observer && this.epoch >= 0
        ? alive.filter(([other, target]) => other !== id && canReadCode(viewer, target, world))
            .map(([other]) => ({ id: other, code: this.codes.get(other)! })) : [];
      this.context.privateCodes(id, { round: state.round, epoch: this.epoch, visible });
    }
  }
  interact(id: string, data: unknown): void {
    const { state, world } = this.context;
    const viewer = state.players.get(id);
    if (state.phase !== 'playing' || !viewer?.connected || viewer.out || viewer.observer || viewer.qualified || viewer.hp <= 0) return;
    if (typeof data !== 'string' || !/^\d{4}$/.test(data) || codeEpoch(state.elapsed) < 0) return;
    if (state.elapsed < (this.nextGuess.get(id) ?? 0)) return;
    this.nextGuess.set(id, state.elapsed + CODE_HUNT.cooldown);
    this.rotate();
    const target = this.context.alive().find(([other, p]) => other !== id && this.codes.get(other) === data && canReadCode(viewer, p, world));
    if (!target) { this.context.notice(id, '@codehunt.miss'); return; }
    this.context.eliminate(target[0]);
    this.codes.delete(target[0]);
    viewer.score++;
    this.context.sound('hit', [target[1].x, target[1].y + 1.5, target[1].z], id);
    this.context.notice(id, '@codehunt.hit');
    this.nextView = 0;
    if (this.context.alive().length <= 1) this.context.complete('last-standing');
  }
}
