import { BLOCK, VoxelWorld, type MapBuilder } from './VoxelWorld.js';
import { MapKit } from './MapKit.js';
export class WallDuelBuilder implements MapBuilder {
  build(): VoxelWorld {
    const world=new VoxelWorld('wallduel',{isPlayable:(x,z)=>Math.abs(x)<12 && z>-16 && z<14,
      spawn:index=>({x:0,y:3,z:index%2===0?-10:2.25})});
    const kit=new MapKit(world);
    kit.fill(-14,0,-18,14,1,14,BLOCK.STONE);
    kit.fill(-14,2,-18,14,2,14,BLOCK.SNOW);
    // Opaque divider: 11m wide, 5m tall. No windows or gaps.
    kit.fill(-5,3,0,5,7,0,BLOCK.DARK);
    for(let x=-5;x<=5;x++) {kit.block(x,2,-1,BLOCK.GOLD);kit.block(x,2,2,BLOCK.GREEN);}
    for(const x of [-6,6]) {kit.fill(x,3,0,x,8,0,BLOCK.STONE);kit.block(x,9,0,BLOCK.GLOW);}
    kit.fill(-1,2,-11,1,2,-9,BLOCK.TILE_RED);
    for(const x of [-12,12])for(const z of [-14,10]){kit.fill(x,3,z,x,5,z,BLOCK.WOOD);kit.block(x,6,z,BLOCK.GLOW);}
    return world;
  }
}
