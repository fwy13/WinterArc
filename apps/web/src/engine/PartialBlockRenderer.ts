import type { Engine } from 'noa-engine';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MAP_HALF, MAP_HEIGHT, blockShape, PALETTE, type VoxelWorld } from 'winterarc-world';
import { shapeQuads, appendShapeQuad, type ShapeGeometry } from 'winterarc-rendering';
import { BLOCK_TEXTURES } from 'winterarc-rendering';

const CHUNK=16;
/** Partial blocks are batched by chunk/material, not one mesh per voxel.
 * noa keeps terrain cubes; our shared movement handles precise partial collision. */
export class PartialBlockRenderer {
  private chunks=new Map<string,Mesh[]>();
  private materials=new Map<number,StandardMaterial>();
  private world?:VoxelWorld;
  private occupied = new Set<string>();
  constructor(private noa:Engine) {}
  private material(id:number):StandardMaterial {
    const cached=this.materials.get(id);if(cached)return cached;
    const scene=this.noa.rendering.getScene(),m=new StandardMaterial(`partial-${id}`,scene);
    m.specularColor=Color3.Black();m.backFaceCulling=false;
    m.diffuseColor=Color3.FromHexString(PALETTE[id][1]);
    const file=BLOCK_TEXTURES[id];
    if(file) { m.diffuseColor=Color3.White();m.diffuseTexture=new Texture(`/textures/${file}.png`,scene,false,false,Texture.NEAREST_SAMPLINGMODE,undefined,()=>{m.diffuseTexture=null;m.diffuseColor=Color3.FromHexString(PALETTE[id][1]);}); }
    if(id===10)m.emissiveColor=Color3.FromHexString('#ffb347');
    this.materials.set(id,m);return m;
  }
  setWorld(world:VoxelWorld):void {
    this.clear();this.world=world;
    for(let x=-MAP_HALF;x<MAP_HALF;x+=CHUNK)for(let z=-MAP_HALF;z<MAP_HALF;z+=CHUNK)this.rebuild(x,z);
  }
  update(cells:readonly {x:number;y:number;z:number}[]):void {
    const keys=new Set<string>();
    for(const p of cells)for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=Math.floor((p.x+dx)/CHUNK)*CHUNK,z=Math.floor((p.z+dz)/CHUNK)*CHUNK;
      if(x>=-MAP_HALF&&x<MAP_HALF&&z>=-MAP_HALF&&z<MAP_HALF) {
        const key = `${x}:${z}`;
        const changedId = this.world?.get(p.x,p.y,p.z) ?? 0;
        if (this.occupied.has(key) || (changedId !== 0 && !blockShape(changedId).fullCube)) keys.add(key);
      }
    }
    for(const key of keys){const [x,z]=key.split(':').map(Number);this.rebuild(x,z);}
  }
  private rebuild(cx:number,cz:number):void {
    const world=this.world;if(!world)return;
    const key=`${cx}:${cz}`;for(const mesh of this.chunks.get(key)??[])mesh.dispose();
    const groups=new Map<number,ShapeGeometry>();
    let containsShape = false;
    for(let x=cx;x<cx+CHUNK;x++)for(let z=cz;z<cz+CHUNK;z++)for(let y=0;y<MAP_HEIGHT;y++) {
      const id=world.get(x,y,z);if(!id||blockShape(id).fullCube)continue;
      containsShape = true;
      for(const q of shapeQuads(id)) {
        const [nx,ny,nz]=q.normal;
        if(q.boundary&&blockShape(world.get(x+nx,y+ny,z+nz)).fullCube)continue;
        let g=groups.get(q.material);if(!g){g={positions:[],normals:[],uvs:[],indices:[]};groups.set(q.material,g);}
        appendShapeQuad(g,q,x,y,z);
      }
    }
    if (containsShape) this.occupied.add(key); else this.occupied.delete(key);
    const meshes:Mesh[]=[];
    for(const [id,g] of groups){
      const mesh=new Mesh(`partial-${key}-${id}`,this.noa.rendering.getScene()),data=new VertexData();
      Object.assign(data,g);data.applyToMesh(mesh);mesh.material=this.material(id);mesh.isPickable=false;
      this.noa.rendering.addMeshToScene(mesh);mesh.freezeWorldMatrix();meshes.push(mesh);
    }
    this.chunks.set(key,meshes);
  }
  private clear():void {for(const list of this.chunks.values())for(const mesh of list)mesh.dispose();this.chunks.clear();this.occupied.clear();}
  dispose():void {this.clear();for(const m of this.materials.values())m.dispose(false,true);this.materials.clear();}
}
