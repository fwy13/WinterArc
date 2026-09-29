import { ATTACK_COOLDOWN, SNOWBALL_DAMAGE, aimSnowball } from 'winterarc-gameplay';
import type { WinterState } from '../state.js';
import type { VoxelWorld } from 'winterarc-world';
import type { ShotEvent } from 'winterarc-protocol';
export class CombatSystem {
  private readonly lastAttack = new Map<string, number>();
  reset(): void {
    this.lastAttack.clear();
  }
  fire(id: string, state: WinterState, world: VoxelWorld, elapsed: number): ShotEvent | null {
    const p = state.players.get(id);
    if (
      !p?.connected ||
      p.hp <= 0 ||
      p.out ||
      state.boss.hp <= 0 ||
      elapsed - (this.lastAttack.get(id) ?? -100) < ATTACK_COOLDOWN
    )
      return null;
    this.lastAttack.set(id, elapsed);
    const shot = aimSnowball(p, state.boss, world);
    if (shot.hit) {
      const damage = Math.min(state.boss.hp, SNOWBALL_DAMAGE);
      state.boss.hp -= damage;
      state.boss.flash = (state.boss.flash + 1) % 65535;
      p.score += damage;
    }
    return { ...shot, playerId: id };
  }
}
