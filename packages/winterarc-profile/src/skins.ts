import type { Vec3 } from 'winterarc-core';

export const COAT_COLORS = ['#d47869', '#77b3a1', '#8d91c8', '#dcaf65', '#769ec4', '#be82ac'];
export const PLAYER_SKINS = [
  { id: 'explorer', cost: 0, coat: '#d47869', accent: '#ffdfa4', face: '#edbb96', hat: 'beanie' },
  { id: 'elf', cost: 180, coat: '#28765a', accent: '#e9c468', face: '#dba27c', hat: 'elf' },
  { id: 'santa', cost: 250, coat: '#be354b', accent: '#fff0da', face: '#f1c4a3', hat: 'santa' },
  { id: 'reindeer', cost: 220, coat: '#95633f', accent: '#e4c48c', face: '#b87b4a', hat: 'antlers' },
  { id: 'frost', cost: 320, coat: '#5cacc7', accent: '#d7f9ff', face: '#b7e9ef', hat: 'crown' },
  { id: 'ginger', cost: 200, coat: '#bd7946', accent: '#fff0d6', face: '#cd915a', hat: 'icing' },
  { id: 'penguin', cost: 240, coat: '#263e53', accent: '#ffc568', face: '#f4f5eb', hat: 'penguin' },
  { id: 'polar', cost: 240, coat: '#e4edf0', accent: '#62bcb2', face: '#faf4e5', hat: 'bear' },
  { id: 'fox', cost: 280, coat: '#cd7546', accent: '#ffe2b1', face: '#f5c792', hat: 'fox' },
  { id: 'snowbot', cost: 360, coat: '#708caa', accent: '#75efda', face: '#233a50', hat: 'robot' },
  { id: 'nutcracker', cost: 300, coat: '#a63850', accent: '#f1c86e', face: '#e9b894', hat: 'soldier' },
  { id: 'wizard', cost: 340, coat: '#61588e', accent: '#b7e5f3', face: '#e7bcab', hat: 'wizard' },
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
  if (id === 'snowman-knockout') {
    block('snow-base','body',[0,.42,0],[.82,.82,.72],'#edfaff');
    block('snow-body','body',[0,1,0],[.65,.6,.6],'#f8fdff');
    block('snow-head','head',[0,.05,0],[.53,.51,.5],'#ffffff');
    block('scarf','body',[0,1.26,0],[.7,.13,.64],COAT_COLORS[coatIndex % COAT_COLORS.length] || '#d47869');
    block('carrot','head',[0,.03,.33],[.12,.12,.25],'#ef912f');
    for (const side of [-1,1]) {
      block('eye','head',[side*.13,.13,.26],[.055,.065,.035],'#18364b');
      block('twig',side<0?'leftArm':'rightArm',[side*.13,-.07,0],[.4,.08,.08],'#805332');
    }
    for (const y of [.75,1]) block('button','body',[0,y,.31],[.08,.08,.035],'#18364b');
    block('hat-brim','head',[0,.34,0],[.65,.08,.6],'#18364b');
    block('hat','head',[0,.47,0],[.4,.22,.4],'#18364b');
    return parts;
  }
  block('jacket' , 'body', [0, .87, 0], [.62, .68, .38], coat);
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
  } else if (skin.hat === 'icing') {
    block('icing-hair', 'head', [0, .24, 0], [.54, .075, .5], skin.accent);
    for (const y of [.83, 1.04]) block('gumdrop', 'body', [0, y, .225], [.12, .11, .06], y < 1 ? '#28765a' : '#be354b');
  }
  if (skin.hat === 'penguin') {
    block('white-bib', 'body', [0, .91, .215], [.43, .45, .05], '#f5f3df');
    block('hood', 'head', [0, .25, -.015], [.56, .14, .51], coat);
    block('beak', 'head', [0, -.06, .31], [.18, .1, .17], skin.accent);
    for (const side of [-1, 1]) {
      block('hood-side', 'head', [side * .26, .02, -.015], [.07, .4, .5], coat);
      block('flipper', side < 0 ? 'leftArm' : 'rightArm', [side * .045, -.27, -.02], [.12, .52, .34], coat);
      block('orange-foot', side < 0 ? 'leftLeg' : 'rightLeg', [0, -.46, .12], [.28, .11, .39], skin.accent);
    }
  } else if (skin.hat === 'bear' || skin.hat === 'fox') {
    const fox = skin.hat === 'fox';
    for (const side of [-1, 1]) {
      block('ear', 'head', [side * .2, .29, 0], [.17, fox ? .27 : .16, .19], coat);
      block('inner-ear', 'head', [side * .2, .3, .105], [.085, fox ? .15 : .08, .035], skin.accent);
    }
    block('muzzle', 'head', [0, -.085, .28], [.29, .16, .13], '#fff3df');
    block('nose', 'head', [0, -.04, .36], [.09, .07, .04], '#263743');
    block('belly', 'body', [0, .92, .21], [.39, .4, .04], '#fff3df');
    block('tail', 'body', [0, fox ? .66 : .65, fox ? -.4 : -.25], [fox ? .23 : .16, fox ? .38 : .15, fox ? .36 : .17], coat);
    if (fox) block('tail-tip', 'body', [0, .82, -.51], [.24, .14, .18], '#fff3df');
  } else if (skin.hat === 'robot') {
    block('helmet', 'head', [0, .255, 0], [.59, .13, .53], coat);
    block('visor', 'head', [0, .04, .275], [.43, .13, .05], '#102b39');
    for (const side of [-1, 1]) {
      block('led-eye', 'head', [side * .11, .04, .307], [.09, .05, .025], skin.accent);
      block('ear-unit', 'head', [side * .3, .02, 0], [.11, .21, .23], coat);
    }
    block('antenna', 'head', [.16, .38, 0], [.04, .17, .04], coat);
    block('antenna-light', 'head', [.16, .48, 0], [.08, .08, .08], skin.accent);
    block('power-cell', 'body', [0, .93, .235], [.19, .22, .07], skin.accent);
    block('battery-pack', 'body', [0, .94, -.29], [.39, .41, .2], '#354b67');
  } else if (skin.hat === 'soldier') {
    block('shako', 'head', [0, .36, 0], [.52, .32, .48], '#263743');
    block('hat-band', 'head', [0, .24, .02], [.57, .07, .52], skin.accent);
    block('hat-badge', 'head', [0, .38, .25], [.13, .14, .04], skin.accent);
    block('brim', 'head', [0, .2, .29], [.54, .05, .16], '#263743');
    block('moustache', 'head', [0, -.09, .27], [.26, .05, .035], '#513a37');
    for (const side of [-1, 1]) {
      block('epaulette', side < 0 ? 'leftArm' : 'rightArm', [0, -.035, 0], [.26, .1, .34], skin.accent);
      for (const y of [.8, .99]) block('gold-button', 'body', [side * .16, y, .215], [.06, .06, .035], skin.accent);
    }
  } else if (skin.hat === 'wizard') {
    block('hat-brim', 'head', [0, .23, 0], [.72, .07, .63], coat);
    block('hat-base', 'head', [0, .34, 0], [.44, .18, .41], coat);
    block('hat-top', 'head', [.045, .48, 0], [.27, .13, .27], coat);
    block('hat-tip', 'head', [.1, .57, 0], [.12, .08, .13], skin.accent);
    block('hat-star', 'head', [0, .35, .22], [.12, .12, .035], skin.accent);
    block('cape', 'body', [0, .91, -.26], [.64, .64, .09], '#403e72');
    block('cape-clasp', 'body', [0, 1.17, .235], [.13, .13, .06], '#f1c86e');
  }
  return parts;
}
