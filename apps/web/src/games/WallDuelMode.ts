import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { DUEL, DUEL_POSES, duelPoint } from 'winterarc-gameplay';
import type { Snapshot, ShotEvent } from 'winterarc-protocol';
import { duelControls, duelPose } from '../engine/WallDuelInput';
import type { GameMode, ModeContext } from './GameMode';

export class WallDuelMode implements GameMode {
  readonly id='wallduel' as const;
  private snapshot: Snapshot | null=null;
  private readonly doll: TransformNode;
  private readonly poses: TransformNode[]=[];
  private readonly rifle: TransformNode;
  private readonly beam: TransformNode;
  private readonly laser: Mesh;
  private readonly dotFront: Mesh;
  private readonly dotBack: Mesh;
  private marks: Mesh[]=[];
  private placed=false;
  private flash=0;
  constructor(private readonly context: ModeContext) {
    const f=context.meshes;
    this.doll=new TransformNode('duel-hider',f.scene);
    DUEL_POSES.forEach((boxes,index)=>{
      const root=new TransformNode(`duel-pose-${index}`,f.scene);root.parent=this.doll;
      for(const [i,box] of boxes.entries())f.cube(root,`duel-body-${index}-${i}`,box.at,box.size,box.color);
      this.poses.push(root);
    });
    this.rifle=new TransformNode('duel-sniper',f.scene);
    f.cube(this.rifle,'rifle-body',[.3,-.25,.8],[.16,.18,.6],'#284253');
    f.cube(this.rifle,'rifle-stock',[.3,-.29,.42],[.18,.25,.3],'#6d827a');
    f.cube(this.rifle,'rifle-barrel',[.3,-.22,1.35],[.055,.055,.6],'#becbd3');
    f.cube(this.rifle,'rifle-scope',[.3,-.1,.82],[.1,.1,.3],'#172d38');
    this.beam=new TransformNode('duel-beam',f.scene);
    this.laser=f.cube(this.beam,'duel-laser',[0,0,7],[.018,.018,14],'#ff3d60',1);
    this.dotFront=f.cube(null,'duel-dot-front',[0,4,-.02],[.13,.13,.018],'#ff3d60',1);
    this.dotBack=f.cube(null,'duel-dot-back',[0,4,1.02],[.13,.13,.018],'#ff3d60',1);
    this.sync(null);
  }
  sync(s: Snapshot | null): void {
    const changed=s?.duel.turn!==this.snapshot?.duel.turn || s?.round!==this.snapshot?.round;
    if(changed) {
      duelPose.set(0);this.placed=false;this.flash=0;
      for(const mark of this.marks)mark.dispose();this.marks=[];
      if(s && s.selfId===s.duel.hunterId) {this.context.noa.camera.heading=s.duel.yaw;this.context.noa.camera.pitch=s.duel.pitch;}
    }
    this.snapshot=s;
    const me=s?.players.find(p=>p.id===s.selfId),active=!!me && !me.out && !me.observer && s?.phase==='playing';
    duelControls.hider=active && s?.selfId===s?.duel.hiderId;
    duelControls.hunter=active && s?.selfId===s?.duel.hunterId;
    if(!s) {this.doll.setEnabled(false);this.rifle.setEnabled(false);this.beam.setEnabled(false);this.dotFront.setEnabled(false);this.dotBack.setEnabled(false);}
  }
  render(dt: number): void {
    const s=this.snapshot,d=s?.duel,noa=this.context.noa;
    const me=s?.players.find(p=>p.id===s.selfId);
    const active=!!s && !!me && !me.out && !me.observer && (s.phase==='playing'||s.phase==='countdown');
    const hiding=active && s?.selfId===d?.hiderId,hunting=active && s?.selfId===d?.hunterId;
    this.doll.setEnabled(!!hiding && !!d?.self);
    this.rifle.setEnabled(!!hunting);
    const laserOn=!!active && s?.phase==='playing' && d?.stage==='hunt';
    this.beam.setEnabled(laserOn);this.dotFront.setEnabled(laserOn);this.dotBack.setEnabled(laserOn);
    if(!s || !d || !active)return;
    if(hiding) {
      // Fixed third-person overview cannot be rotated around the divider to expose the hunter.
      noa.camera.heading=Math.PI;noa.camera.pitch=.34;
      noa.ents.setPosition(noa.playerEntity,[0,4,11]);
      const pos=this.doll.position,ease=this.placed?1-Math.exp(-22*dt):1;
      pos.x+=((d.self?.x??0)-pos.x)*ease;pos.y=DUEL.floor;pos.z=DUEL.hiderZ;this.placed=true;
      this.poses.forEach((p,i)=>p.setEnabled(i===(d.self?.pose??0)));
    } else if(hunting) {
      noa.camera.heading=Math.max(-.42,Math.min(.42,noa.camera.heading));
      noa.camera.pitch=Math.max(-.26,Math.min(.26,noa.camera.pitch));
      noa.ents.setPosition(noa.playerEntity,[0,DUEL.floor,DUEL.hunterZ]);
      this.rifle.position.set(0,DUEL.eye,DUEL.hunterZ);
      this.rifle.rotation.set(noa.camera.pitch,noa.camera.heading,0);
    }
    this.beam.position.set(0,DUEL.eye,DUEL.hunterZ);this.beam.rotation.set(d.pitch,d.yaw,0);
    this.dotFront.position.set(...duelPoint(d.yaw,d.pitch,-.02));
    this.dotBack.position.set(...duelPoint(d.yaw,d.pitch,1.02));
    this.flash=Math.max(0,this.flash-dt);
    const width=this.flash>0?5:d.charge>0?2.5:1;
    this.laser.scaling.x=this.laser.scaling.y=width;
    this.dotFront.scaling.x=this.dotFront.scaling.y=this.dotBack.scaling.x=this.dotBack.scaling.y=width;
  }
  interaction(): null {return null;}
  onShot(e: ShotEvent): void {
    if(!this.snapshot || e.playerId!==this.snapshot.duel.hunterId)return;
    this.flash=.12;
    for(const z of [-.035,1.035]) {
      const ratio=(z-e.from[2])/(e.to[2]-e.from[2]),x=e.from[0]+(e.to[0]-e.from[0])*ratio,y=e.from[1]+(e.to[1]-e.from[1])*ratio;
      if(x>=-5 && x<=6 && y>=3 && y<=8)this.marks.push(this.context.meshes.cube(null,'duel-bullet-mark',[x,y,z],[.1,.1,.025],'#f5d88b',.6));
    }
    while(this.marks.length>6)this.marks.shift()?.dispose();
  }
  dispose(): void {
    duelControls.hider=duelControls.hunter=false;
    this.doll.dispose();this.rifle.dispose();this.beam.dispose();this.dotFront.dispose();this.dotBack.dispose();
    for(const mark of this.marks)mark.dispose();
  }
}
