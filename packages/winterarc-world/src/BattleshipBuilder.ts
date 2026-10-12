import { BLOCK,VoxelWorld,type MapBuilder } from './VoxelWorld.js';
import { MapKit } from './MapKit.js';
export class BattleshipBuilder implements MapBuilder {
 build():VoxelWorld {const world=new VoxelWorld('battleship',{isPlayable:(x,z)=>Math.abs(x)<25&&Math.abs(z)<25,spawn:()=>({x:0,y:3,z:-12})});const kit=new MapKit(world);kit.fill(-32,0,-32,32,1,32,BLOCK.WATER);kit.fill(-5,2,-17,5,2,-10,BLOCK.WOOD);for(const x of [-6,6]){kit.fill(x,1,-12,x,5,-12,BLOCK.LOG);kit.block(x,6,-12,BLOCK.GLOW);}return world;}
}
