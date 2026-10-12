import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Snapshot, ShotEvent } from 'winterarc-protocol';
import { CharacterModel } from '../engine/CharacterModel';
import { knockoutControls, knockoutPower } from '../engine/KnockoutInput';
import type { GameMode, ModeContext } from './GameMode.js';
export class KnockoutMode implements GameMode {
  readonly id = 'knockout' as const;
  private snapshot: Snapshot | null = null;
  private self: CharacterModel | null = null;
  private placed = false;
  private arrows = new Map<string, TransformNode>();
  constructor(private readonly context: ModeContext) {}
  sync(s: Snapshot | null): void {
    if (s?.knockout.turn !== this.snapshot?.knockout.turn) knockoutPower.set(5);
    this.snapshot = s;
    const me=s?.players.find(p=>p.id===s.selfId);
    knockoutControls.enabled = !!me && !me.out && !me.observer && s?.phase==='playing' && s.knockout.stage==='aim';
    this.context.map.applyBrokenIce(s?.brokenIce ?? []);
    if (!s) { this.self?.root.setEnabled(false); this.placed=false; }
    else if (!this.self && me) this.self=new CharacterModel(this.context.meshes,'knockout-self','snowman-knockout',me.color);
  }
  private arrow(id: string, own: boolean): TransformNode {
    let root=this.arrows.get(id); if (root) return root;
    root=new TransformNode(`launch-arrow-${id}`,this.context.meshes.scene);
    const color=own?'#78f5dd':'#ffce75', f=this.context.meshes;
    f.cube(root,'arrow-shaft',[0,0,1.5],[.18,.06,1.8],color,.65);
    for (const side of [-1,1]) {
      const wing=f.cube(root,'arrow-tip',[side*.28,0,2.3],[.15,.06,.85],color,.65);
      wing.rotation.y=-side*Math.PI/4;
    }
    this.arrows.set(id,root); return root;
  }
  render(dt: number, time: number): void {
    const s=this.snapshot, me=s?.players.find(p=>p.id===s.selfId), noa=this.context.noa;
    for (const arrow of this.arrows.values()) arrow.setEnabled(false);
    const active=!!s && !!me && !me.observer && !me.out && !me.qualified && s.phase!=='lobby';
    this.self?.root.setEnabled(active);
    if (!s || !me) return;
    if (active && this.self) {
      const pos=this.self.root.position, ease=this.placed?1-Math.exp(-16*dt):1;
      pos.x+=(me.x-pos.x)*ease;pos.y+=(me.y-pos.y)*ease;pos.z+=(me.z-pos.z)*ease;this.placed=true;
      this.self.root.rotation.y=s.knockout.stage==='aim'?noa.camera.heading:me.yaw;
      this.self.animate(dt,time,0,true,0);
      // Orbit the real player using only the local camera carrier, never server position.
      const pitch=Math.max(.35,Math.min(1.15,noa.camera.pitch)), distance=10, flat=Math.cos(pitch)*distance;
      noa.camera.pitch=pitch;
      noa.ents.setPosition(noa.playerEntity,[pos.x-Math.sin(noa.camera.heading)*flat,pos.y+Math.sin(pitch)*distance,pos.z-Math.cos(noa.camera.heading)*flat]);
    }
    if (s.phase!=='playing') return;
    for (const p of s.players) {
      const own=p.id===s.selfId;
      const reveal=s.knockout.stage==='reveal' || (s.knockout.stage==='slide' && s.knockout.remaining>3.3);
      if (p.out || p.observer || (!reveal && !(own && active && s.knockout.stage==='aim'))) continue;
      const arrow=this.arrow(p.id,own);
      const position = own && active && this.self ? this.self.root.position : p;
      arrow.setEnabled(true);arrow.position.set(position.x,Math.max(9.06,position.y+.05),position.z);
      arrow.rotation.y=own && s.knockout.stage==='aim'?noa.camera.heading:p.yaw;
      const power=own && s.knockout.stage==='aim'?knockoutPower.get():p.launchPower ?? 5;
      arrow.scaling.z=.45+power*.17;
    }
  }
  interaction(): null { return null; }
  onShot(_event: ShotEvent): void {}
  dispose(): void {
    knockoutControls.enabled=false;
    this.self?.root.dispose();for (const arrow of this.arrows.values()) arrow.dispose();this.arrows.clear();
  }
}
