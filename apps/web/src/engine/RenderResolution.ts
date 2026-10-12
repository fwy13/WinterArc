/** CSS pixels -> backing-buffer pixels. 100% uses native DPR, with a pixel budget for very large screens. */
export function renderPixelRatio(width: number, height: number, dpr: number, scale: number, touch: boolean): number {
  const density=Number.isFinite(dpr) && dpr>0 ? Math.min(dpr,4) : 1;
  const quality=Number.isFinite(scale) && scale<=2 ? Math.max(.5,Math.min(2,scale)) : 1;
  const area=Math.max(1,width)*Math.max(1,height);
  const budget=touch ? 8_294_400 : 12_000_000;
  return Math.min(density*quality,4,Math.sqrt(budget/area));
}
interface ResolutionEngine {
  getRenderingCanvas(): HTMLCanvasElement | null;
  setHardwareScalingLevel(level: number): void;
  resize(): void;
}
export function bindRenderResolution(engine: ResolutionEngine, getScale:()=>number) {
  let disposed=false,frame=0,lastLevel=0;
  let densityQuery: MediaQueryList | undefined;
  const touchQuery=window.matchMedia('(any-pointer: coarse)');
  const canvas=engine.getRenderingCanvas();
  const schedule=()=>{
    if(!disposed && !frame)frame=requestAnimationFrame(()=>{frame=0;refresh();});
  };
  const watchDensity=()=>{
    densityQuery?.removeEventListener('change',densityChanged);
    densityQuery=window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change',densityChanged);
  };
  const densityChanged=()=>{watchDensity();schedule();};
  const refresh=()=>{
    if(disposed || !canvas)return;
    const {width,height}=canvas.getBoundingClientRect();
    if(width<=0 || height<=0)return;
    const ratio=renderPixelRatio(width,height,window.devicePixelRatio,getScale(),touchQuery.matches);
    const level=1/ratio;
    if(Math.abs(level-lastLevel)>.0001){lastLevel=level;engine.setHardwareScalingLevel(level);}
    engine.resize();
  };
  const observer=new ResizeObserver(schedule);
  if(canvas)observer.observe(canvas);
  window.addEventListener('resize',schedule);
  touchQuery.addEventListener('change',schedule);
  watchDensity();refresh();
  return {refresh,dispose:()=>{
    disposed=true;cancelAnimationFrame(frame);observer.disconnect();
    window.removeEventListener('resize',schedule);
    touchQuery.removeEventListener('change',schedule);
    densityQuery?.removeEventListener('change',densityChanged);
  }};
}
