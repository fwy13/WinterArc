import { canReachPoint } from 'winterarc-gameplay';
import type { RoundContext, RoundController } from './RoundContext.js';

export class GiftRaceRound implements RoundController {
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    this.context.state.goal = this.context.world.race.checkpoints.length;
  }
  update(): void {
    for (const [id, p] of this.context.alive()) {
      if (p.qualified) continue;
      const { world } = this.context;
      const route = world.race;
      if (p.y <= world.loseY) {
        const spawn = p.checkpoint ? route.checkpoints[p.checkpoint - 1] : world.spawn(this.context.roster.indexOf(id));
        Object.assign(p, { x: spawn.x, y: spawn.y, z: spawn.z, vy: 0 });
        p.deaths = Math.min(255, p.deaths + 1);
      }
      const next = route.checkpoints[p.checkpoint];
      if (next && Math.abs(p.z - next.z) <= 2 && Math.abs(p.x - next.x) <= next.radius && Math.abs(p.y - next.y) < 2) {
        p.checkpoint++;
        p.score = p.checkpoint;
        this.context.sound('deliver', [p.x, p.y + 1, p.z], id);
      }
      const destination = route.checkpoints[p.checkpoint] ?? route.finish;
      p.progress = -Math.hypot(p.x - destination.x, p.y - destination.y, p.z - destination.z);
    }
  }
  interact(id: string): void {
    const p = this.context.state.players.get(id);
    const { checkpoints, finish } = this.context.world.race;
    if (!p || p.checkpoint !== checkpoints.length || !canReachPoint(p, finish.x, finish.y + 1, finish.z, finish.radius)) return;
    p.score++;
    this.context.sound('deliver', [finish.x, finish.y + 1, finish.z], id);
    this.context.qualify(id);
  }
}
