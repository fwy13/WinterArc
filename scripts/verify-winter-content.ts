import assert from 'node:assert/strict';
import { WorldFactory } from '../packages/winterarc-world/src/WorldFactory.js';
import { clearSupportedFeet } from '../packages/winterarc-world/src/BlockShapes.js';
import { collides } from '../packages/winterarc-gameplay/src/movement.js';
import { updateColorFloor } from '../packages/winterarc-world/src/ColorFallBuilder.js';
import { PLAYER_SKINS, avatarParts } from '../packages/winterarc-profile/src/skins.js';
for(const id of WorldFactory.getRegisteredIds()) {
 const w=WorldFactory.create(id),w2=WorldFactory.create(id);
 assert.deepEqual(w.data,w2.data,`${id} determinism`);
 for(let i=0;i<32;i++) {const p=w.spawn(i); assert(!collides(w,p.x,p.y,p.z),`${id} spawn ${i} obstructed`);assert(clearSupportedFeet(w.get,p.x,p.y,p.z),`${id} spawn ${i} unsupported`);}
 for(const p of w.targetSpawns) assert(clearSupportedFeet(w.get,p.x,p.y,p.z),`${id} target ${JSON.stringify(p)}`);
 if(id==='giftrace') for(const p of [...w.race.checkpoints,w.race.finish]) assert(clearSupportedFeet(w.get,p.x,p.y,p.z),'race checkpoint');
 if(id==='icebreak') for(let x=-18;x<=18;x++)for(let z=-18;z<=18;z++)if(Math.hypot(x+.5,z+.5)<=18)assert.equal(w.get(x,8,z),8);
 if(id==='colorfall') {updateColorFloor(w,1,17,true);for(let x=-18;x<18;x++)for(let z=-18;z<18;z++){assert([0,17].includes(w.get(x,8,z)));for(let y=2;y<8;y++)assert.equal(w.get(x,y,z),0,'No rescue floor');}}
 console.log(`${id}: deterministic; 32 clear, supported spawns; ${w.targetSpawns.length} supported targets`);
}
assert.equal(new Set(PLAYER_SKINS.map(s=>s.id)).size,12);
for(const skin of PLAYER_SKINS)for(const p of avatarParts(skin.id)){assert(p.position.every(Number.isFinite));assert(p.size.every(n=>n>0&&Number.isFinite(n)));}
console.log('12 character geometries valid');
