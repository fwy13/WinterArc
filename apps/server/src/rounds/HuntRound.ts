import { canFind, HUNT_GOAL } from 'winterarc-gameplay';
import { randomFromSeed } from 'winterarc-world';
import { SnowmanState } from '../state.js';
import type { RoundContext, RoundController } from './RoundContext.js';
export class HuntRound implements RoundController {
  constructor(private readonly context: RoundContext) {}
  prepare(): void {
    const { state, world } = this.context;
    const random = randomFromSeed(state.seed);
    const shuffle = <T>(items: T[]): T[] => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };
    // Always include aerial parkour targets, plus randomly sampled ground/roof hiding spots.
    const aerial = shuffle(world.targetSpawns.filter((p) => p.zone === 'parkour')).slice(0, 6);
    const other = shuffle(world.targetSpawns.filter((p) => p.zone !== 'parkour')).slice(0, 18);
    [...aerial, ...other].forEach((p, i) =>
      state.targets.push(Object.assign(new SnowmanState(), p, { id: `snow-${i}` })),
    );
    state.total = state.targets.length;
    state.goal = Math.min(HUNT_GOAL, state.total);
  }
  update(): void {
    const { world } = this.context;
    for (const [id, p] of this.context.alive()) {
      if (!p.qualified && p.y <= world.loseY) {
        Object.assign(p, world.spawn(this.context.roster.indexOf(id)), { vy: 0 });
        p.deaths = Math.min(255, p.deaths + 1);
      }
    }
  }
  interact(id: string, data: unknown): void {
    if (typeof data !== 'string') return;
    const { state, world } = this.context;
    const p = state.players.get(id);
    const target = state.targets.find((t) => t.id === data);
    if (!p || !target || p.found.includes(data) || !canFind(p, target, world)) return;
    p.found.push(data);
    p.score = p.found.length;
    p.progress = state.elapsed;
    this.context.found(id, p.score);
    if (p.score >= state.goal) this.context.qualify(id);
  }
}
