import type { Vec3 } from 'winterarc-core';

export const COAT_COLORS = ['#d47869', '#77b3a1', '#8d91c8', '#dcaf65', '#769ec4', '#be82ac'];
export const PLAYER_SKINS = [
  { id: 'explorer', cost: 0, coat: '#d47869', accent: '#ffdfa4', face: '#edbb96', hat: 'beanie' },
  { id: 'elf', cost: 180, coat: '#28765a', accent: '#e9c468', face: '#dba27c', hat: 'elf' },
  { id: 'santa', cost: 250, coat: '#be354b', accent: '#fff0da', face: '#f1c4a3', hat: 'santa' },
  { id: 'reindeer', cost: 220, coat: '#95633f', accent: '#e4c48c', face: '#b87b4a', hat: 'antlers' },
  { id: 'frost', cost: 320, coat: '#5cacc7', accent: '#d7f9ff', face: '#b7e9ef', hat: 'crown' },
  { id: 'ginger', cost: 200, coat: '#bd7946', accent: '#fff0d6', face: '#cd915a', hat: 'icing' },
] as const;
export type SkinId = typeof PLAYER_SKINS[number]['id'];
export type BodyGroup = 'body' | 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export interface AvatarPart { name: string; group: BodyGroup; position: Vec3; size: Vec3; color: string }
export const AVATAR_PIVOTS: Record<BodyGroup, Vec3> = {
  body: [0, 0, 0], head: [0, 1.39, 0],
  leftArm: [-0.4, 1.14, 0], rightArm: [0.4, 1.14, 0],
  leftLeg: [-0.17, 0.53, 0], rightLeg: [0.17, 0.53, 0],
};
/** Shared geometry for the actual voxel avatar and its lightweight shop preview. */
export function avatarParts(id: string, coatIndex = 0): AvatarPart[] {
  const skin = PLAYER_SKINS.find(s => s.id === id) || PLAYER_SKINS[0];
  const coat = skin.id === 'explorer' ? COAT_COLORS[coatIndex % COAT_COLORS.length] || COAT_COLORS[0] : skin.coat;
  const parts: AvatarPart[] = [];
  const block = (name: string, group: BodyGroup, position: Vec3, size: Vec3, color: string) => parts.push({ name, group, position, size, color });
  block('jacket', 'body', [0, .87, 0], [.62, .68, .38], coat);
  block('belt', 'body', [0, .62, .015], [.64, .09, .4], '#293b49');
  block('buckle', 'body', [0, .62, .225], [.12, .11, .05], skin.accent);
  block('zipper', 'body', [0, .89, .2], [.045, .42, .025], skin.accent);
  block('scarf', 'body', [0, 1.22, 0], [.67, .12, .43], skin.accent);
  block('scarf-tail', 'body', [.19, 1.02, .24], [.14, .36, .06], skin.accent);
  block('head', 'head', [0, 0, 0], [.5, .44, .46], skin.face);
  for (const side of [-1, 1]) {
    const arm: BodyGroup = side < 0 ? 'leftArm' : 'rightArm';
    const leg: BodyGroup = side < 0 ? 'leftLeg' : 'rightLeg';
    block('sleeve', arm, [0, -.22, 0], [.2, .44, .29], coat);
    block('mitten', arm, [0, -.47, .015], [.22, .16, .31], skin.accent);
    block('trousers', leg, [0, -.15, 0], [.24, .3, .28], skin.id === 'ginger' ? coat : '#354353');
    block('boot', leg, [0, -.405, .045], [.27, .21, .37], skin.id === 'elf' ? '#be354b' : '#263743');
    block('eye', 'head', [side * .115, .035, .24], [.065, .075, .035], '#213542');
    block('cheek', 'head', [side * .18, -.065, .24], [.075, .045, .025], skin.id === 'frost' ? '#73c4df' : '#dc8e80');
  }
  block('smile', 'head', [0, -.115, .245], [.1, .027, .025], '#744c42');
  if (skin.hat === 'beanie') {
    block('cap', 'head', [0, .255, -.01], [.56, .19, .52], coat);
    block('pom', 'head', [.12, .4, 0], [.15, .15, .15], skin.accent);
    block('goggles', 'head', [0, .21, .27], [.34, .1, .04], '#385d76');
    block('backpack', 'body', [0, .91, -.3], [.48, .5, .24], '#496574');
  } else if (skin.hat === 'elf' || skin.hat === 'santa') {
    block('hat-brim', 'head', [0, .24, 0], [.58, .11, .53], skin.accent);
    block('hat', 'head', [0, .34, 0], [.43, .15, .4], coat);
    block('hat-tip', 'head', [.16, .44, 0], [.25, .1, .23], coat);
    block('bell', 'head', [.31, .42, 0], [.1, .12, .1], skin.accent);
    if (skin.hat === 'santa') block('beard', 'head', [0, -.15, .26], [.38, .19, .11], skin.accent);
    else for (const side of [-1, 1]) block('ear', 'head', [side * .3, 0, 0], [.14, .15, .19], skin.face);
  } else if (skin.hat === 'antlers') {
    for (const side of [-1, 1]) {
      block('antler', 'head', [side * .2, .36, 0], [.075, .31, .075], '#68462f');
      block('antler-tine', 'head', [side * .29, .4, 0], [.2, .065, .075], '#68462f');
    }
    block('red-nose', 'head', [0, -.055, .29], [.12, .1, .11], '#dc435a');
  } else if (skin.hat === 'crown') {
    block('crown-band', 'head', [0, .25, 0], [.55, .08, .5], skin.accent);
    for (const x of [-.19, 0, .19]) block('ice-spike', 'head', [x, .36, .19], [.09, x === 0 ? .22 : .15, .09], skin.accent);
    block('ice-pack', 'body', [0, .96, -.27], [.4, .42, .17], '#8fd6e8');
  } else {
    block('icing-hair', 'head', [0, .24, 0], [.54, .075, .5], skin.accent);
    for (const y of [.83, 1.04]) block('gumdrop', 'body', [0, y, .225], [.12, .11, .06], y < 1 ? '#28765a' : '#be354b');
  }
  return parts;
}
