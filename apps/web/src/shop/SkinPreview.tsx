import { useMemo } from 'react';
import { avatarParts, AVATAR_PIVOTS } from 'winterarc-profile';

/** Same box geometry as CharacterModel; SVG preview does not allocate another WebGL context. */
export default function SkinPreview({ skinId, color = 0 }: { skinId: string; color?: number }) {
  const faces = useMemo(() => {
    const project = (x: number, y: number, z: number) => `${110 + (x - z * .5) * 65},${190 - (y + z * .2) * 83}`;
    return avatarParts(skinId, color).map(part => {
      const pivot = AVATAR_PIVOTS[part.group];
      const [x, y, z] = part.position.map((v, i) => v + pivot[i]);
      const [w, h, d] = part.size.map(v => v / 2);
      return { color: part.color, depth: z + y * .01,
        front: [project(x-w,y-h,z+d), project(x+w,y-h,z+d), project(x+w,y+h,z+d), project(x-w,y+h,z+d)].join(' '),
        top: [project(x-w,y+h,z-d), project(x+w,y+h,z-d), project(x+w,y+h,z+d), project(x-w,y+h,z+d)].join(' '),
        side: [project(x+w,y-h,z-d), project(x+w,y-h,z+d), project(x+w,y+h,z+d), project(x+w,y+h,z-d)].join(' '),
      };
    }).sort((a, b) => a.depth - b.depth);
  }, [skinId, color]);
  return <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden="true">
    <ellipse cx="110" cy="198" rx="47" ry="10" fill="#244938" opacity=".12" />
    {faces.map((f, i) => <g key={i} fill={f.color}>
      <polygon points={f.side} /><polygon points={f.side} fill="black" opacity=".18" />
      <polygon points={f.top} /><polygon points={f.top} fill="white" opacity=".14" />
      <polygon points={f.front} />
    </g>)}
  </svg>;
}
