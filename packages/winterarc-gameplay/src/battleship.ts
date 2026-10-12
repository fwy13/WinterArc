export const SEA_SIZE=6;
export const SEA_LENGTHS=[3,2,2] as const;
/** Randomness supplied by server crypto; do not use the public match seed for fleets. */
export function createFleet(random:(max:number)=>number):number[] {
  const board=Array<number>(36).fill(0);
  SEA_LENGTHS.forEach((length,index)=>{
    const candidates:number[][]=[];
    for(let row=0;row<6;row++)for(let col=0;col<6;col++)for(const vertical of [false,true]){
      if(col+(vertical?1:length)>6||row+(vertical?length:1)>6)continue;
      const cells=Array.from({length},(_,i)=>(row+(vertical?i:0))*6+col+(vertical?0:i));
      if(cells.every(c=>!board[c]))candidates.push(cells);
    }
    for(const cell of candidates[random(candidates.length)])board[cell]=index+1;
  });return board;
}
export function fleetSunk(board:number[],shots:number[]):number {
  return SEA_LENGTHS.filter((_,i)=>board.every((ship,cell)=>ship!==i+1||shots[cell]>=2)).length;
}
export function fireAtFleet(board:number[],shots:number[],cell:number):boolean {
  if(!Number.isInteger(cell)||cell<0||cell>=36||shots[cell])return false;
  shots[cell]=board[cell]?2:1;
  const ship=board[cell];
  if(ship && board.every((v,c)=>v!==ship||shots[c]>=2))board.forEach((v,c)=>{if(v===ship)shots[c]=3;});
  return true;
}
