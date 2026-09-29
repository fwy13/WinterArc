/** All coordinates are local to one voxel, in [0, 1]. No renderer dependency. */
export type BlockBox = readonly [number, number, number, number, number, number];
export interface ShapePart { box: BlockBox; material: number }
export interface BlockShape {
  kind: 'cube' | 'slab' | 'stairs' | 'torch' | 'air';
  fullCube: boolean;
  collision: readonly BlockBox[];
  selection: readonly BlockBox[];
  parts: readonly ShapePart[];
  /** One clockwise quarter turn (x,z) -> (1-z,x). */
  rotateTo?: number;
}
const cube: BlockBox = [0, 0, 0, 1, 1, 1];
const solid: BlockShape = { kind: 'cube', fullCube: true, collision: [cube], selection: [cube], parts: [] };
const air: BlockShape = { kind: 'air', fullCube: false, collision: [], selection: [], parts: [] };
function turn(box: BlockBox): BlockBox { return [1-box[5], box[1], box[0], 1-box[2], box[4], box[3]]; }
function rotate(box: BlockBox, turns: number): BlockBox {
  for (let i = 0; i < turns; i++) box = turn(box);
  return box;
}
function stair(id: number, turns: number): BlockShape {
  const base: BlockBox[] = [[0,0,0,1,0.5,1], [0,0.5,0.5,1,1,1]];
  const boxes = base.map(box => rotate(box, turns));
  return { kind: 'stairs', fullCube: false, collision: boxes, selection: boxes,
    parts: boxes.map(box => ({ box, material: 3 })), rotateTo: 24 + ((id - 24 + 1) % 4) };
}
function torch(id: number, turns?: number): BlockShape {
  const body: BlockBox = turns === undefined ? [0.44,0,0.44,0.56,0.62,0.56] : [0.44,0.2,0.7,0.56,0.75,0.88];
  const flame: BlockBox = turns === undefined ? [0.39,0.57,0.39,0.61,0.85,0.61] : [0.39,0.7,0.65,0.61,0.95,0.93];
  const boxes = [body, flame].map(b => rotate(b, turns ?? 0));
  // Wall variant has a short bracket connecting it to the supporting +Z face.
  const bracket = rotate([0.44,0.2,0.88,0.56,0.32,1], turns ?? 0);
  const parts = [{ box: boxes[0], material: 3 }, { box: boxes[1], material: 10 }];
  if (turns !== undefined) parts.push({ box: bracket, material: 3 });
  return { kind: 'torch', fullCube: false, collision: [], selection: parts.map(p => p.box), parts,
    rotateTo: turns === undefined ? id : 29 + ((id - 29 + 1) % 4) };
}
export const SPECIAL_BLOCK_SHAPES: Readonly<Record<number, BlockShape>> = {
  22: { kind: 'slab', fullCube: false, collision: [[0,0,0,1,0.5,1]], selection: [[0,0,0,1,0.5,1]], parts: [{box:[0,0,0,1,0.5,1],material:3}], rotateTo:22 },
  23: { kind: 'slab', fullCube: false, collision: [[0,0.5,0,1,1,1]], selection: [[0,0.5,0,1,1,1]], parts: [{box:[0,0.5,0,1,1,1],material:3}], rotateTo:23 },
  24: stair(24,0), 25: stair(25,1), 26: stair(26,2), 27: stair(27,3),
  28: torch(28), 29: torch(29,0), 30: torch(30,1), 31: torch(31,2), 32: torch(32,3),
};
export function blockShape(id: number): BlockShape { return id === 0 ? air : SPECIAL_BLOCK_SHAPES[id] ?? solid; }
export function rotateBlock(id: number, turns = 1): number {
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) id = blockShape(id).rotateTo ?? id;
  return id;
}
export function boxesIntersect(a: BlockBox, b: BlockBox, epsilon = 1e-5): boolean {
  return a[0] < b[3]-epsilon && a[3] > b[0]+epsilon && a[1] < b[4]-epsilon && a[4] > b[1]+epsilon && a[2] < b[5]-epsilon && a[5] > b[2]+epsilon;
}
/** Marker validation for fractional slab/stair floors. */
export function clearSupportedFeet(get: (x:number,y:number,z:number)=>number, x:number,y:number,z:number): boolean {
  const body: BlockBox = [x-0.29,y,z-0.29,x+0.29,y+2,z+0.29];
  let support = false;
  for (let bx = Math.floor(x-0.29); bx <= Math.floor(x+0.29); bx++)
    for (let bz = Math.floor(z-0.29); bz <= Math.floor(z+0.29); bz++)
      for (let by = Math.floor(y-0.03); by <= Math.floor(y+2); by++)
        for (const box of blockShape(get(bx,by,bz)).collision) {
          const world: BlockBox = [bx+box[0],by+box[1],bz+box[2],bx+box[3],by+box[4],bz+box[5]];
          if (boxesIntersect(body,world)) return false;
          if (Math.abs(world[4]-y) < 0.031 && x >= world[0] && x <= world[3] && z >= world[2] && z <= world[5]) support = true;
        }
  return support;
}
