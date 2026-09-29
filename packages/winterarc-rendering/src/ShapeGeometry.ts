import { blockShape, type BlockBox } from 'winterarc-world';
export interface ShapeQuad {
  positions: number[];
  normal: readonly number[];
  uvs: number[];
  material: number;
  boundary: boolean;
}
const cache = new Map<number, ShapeQuad[]>();
const inside = (p:number[], b:BlockBox) => p.every((v,i)=>v>b[i]+1e-8 && v<b[i+3]-1e-8);

/** Build the exterior of the union of boxes, splitting faces at shared planes.
 * Cached per ID, shared by game chunks and editor chunks. */
export function shapeQuads(id:number): readonly ShapeQuad[] {
  const cached=cache.get(id); if(cached) return cached;
  const parts=blockShape(id).parts, quads:ShapeQuad[]=[];
  for (let partIndex=0;partIndex<parts.length;partIndex++) {
    const {box,material}=parts[partIndex];
    for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
      const u=(axis+1)%3,v=(axis+2)%3, plane=box[axis+(sign>0?3:0)];
      const cuts=(a:number)=> [...new Set([box[a],box[a+3],...parts.flatMap(p=>[p.box[a],p.box[a+3]]).filter(n=>n>box[a]&&n<box[a+3])])].sort((a,b)=>a-b);
      const us=cuts(u),vs=cuts(v);
      for(let i=0;i<us.length-1;i++) for(let j=0;j<vs.length-1;j++) {
        const point=[0,0,0]; point[axis]=plane+sign*0.00001; point[u]=(us[i]+us[i+1])/2; point[v]=(vs[j]+vs[j+1])/2;
        if(parts.some((p,index)=>index!==partIndex&&inside(point,p.box))) continue;
        const coords=[[us[i],vs[j]],[us[i+1],vs[j]],[us[i+1],vs[j+1]],[us[i],vs[j+1]]];
        if(sign<0) coords.reverse();
        const positions:number[]=[],uvs:number[]=[];
        for(const [a,b] of coords) { const p=[0,0,0];p[axis]=plane;p[u]=a;p[v]=b;positions.push(...p);uvs.push(a,b); }
        const normal=[0,0,0];normal[axis]=sign;
        quads.push({positions,uvs,normal,material,boundary:sign<0?plane===0:plane===1});
      }
    }
  }
  cache.set(id,quads);return quads;
}
export interface ShapeGeometry { positions:number[];normals:number[];uvs:number[];indices:number[] }
export function appendShapeQuad(g:ShapeGeometry,q:ShapeQuad,x:number,y:number,z:number):void {
  const offset=g.positions.length/3;
  for(let i=0;i<q.positions.length;i+=3) { g.positions.push(q.positions[i]+x,q.positions[i+1]+y,q.positions[i+2]+z);g.normals.push(...q.normal); }
  g.uvs.push(...q.uvs);g.indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
}
