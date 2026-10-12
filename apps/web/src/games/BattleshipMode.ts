import type { Snapshot,ShotEvent } from 'winterarc-protocol';
import type { GameMode,ModeContext } from './GameMode';
import { seaInput } from '../engine/SeaInput';
export class BattleshipMode implements GameMode {
 readonly id='battleship' as const;
 private state:Snapshot|null=null;
 constructor(private readonly context:ModeContext){}
 sync(state:Snapshot|null){if(state?.sea.turn!==this.state?.sea.turn)seaInput.pending=null;this.state=state;}
 render(){if(!this.state)return;const noa=this.context.noa;noa.camera.heading=0;noa.camera.pitch=.55;noa.ents.setPosition(noa.playerEntity,[0,12,-20]);}
 interaction():null{return null;}
 onShot(_event:ShotEvent){}
 dispose(){seaInput.pending=null;}
}
