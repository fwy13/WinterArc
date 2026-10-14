import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PALETTE, updateColorFloor } from 'winterarc-world';
import type { Snapshot } from 'winterarc-protocol';
import { t, type TranslationKey } from '../i18n';
import type { GameMode, ModeContext } from './GameMode.js';
export class ColorFallMode implements GameMode {
  readonly id = 'colorfall' as const;
  private readonly board;
  private readonly texture;
  private readonly material;
  private geometryKey = '';
  private textKey = '';
  private snapshot: Snapshot | null = null;
  constructor(private readonly context: ModeContext) {
    this.board = CreatePlane(
      'color-countdown-board',
      { width: 15, height: 6 },
      context.meshes.scene,
    );
    this.board.position.set(0, 16, 20);
    this.board.isPickable = false;
    this.texture = new DynamicTexture(
      'color-countdown',
      { width: 1024, height: 512 },
      context.meshes.scene,
      false,
    );
    this.material = new StandardMaterial('color-countdown-material', context.meshes.scene);
    this.material.diffuseTexture = this.texture;
    this.material.emissiveColor = Color3.White();
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.board.material = this.material;
    context.noa.rendering.addMeshToScene(this.board);
  }
  sync(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
    const floor = snapshot?.floor;
    if (!floor) return;
    const key = `${floor.cycle}:${floor.safeBlock}:${floor.dropped}`;
    if (key === this.geometryKey) return;
    this.geometryKey = key;
    const touched: { x: number; y: number; z: number }[] = [];
    updateColorFloor(
      this.context.map.world,
      floor.cycle,
      floor.safeBlock,
      floor.dropped,
      (x, y, z, block) => {
        if (this.context.map.world.get(x, y, z) === block) return;
        this.context.map.world.set(x, y, z, block);
        touched.push({ x, y, z });
      },
    );
    this.context.map.updateChunks(touched);
  }
  render(): void {
    const f = this.snapshot?.floor;
    if (!f) return;
    const label = t(`tile.${f.safeBlock}` as TranslationKey);
    const seconds = Math.ceil(f.remaining);
    const title = t(f.dropped ? 'floor.return' : 'floor.stand');
    const key = `${label}:${seconds}:${title}`;
    if (this.textKey === key) return;
    this.textKey = key;
    const canvas = this.texture.getContext() as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    canvas.fillStyle = '#0b1d29';
    canvas.fillRect(0, 0, 1024, 512);
    canvas.fillStyle = PALETTE[f.safeBlock][1];
    canvas.fillRect(36, 36, 952, 440);
    canvas.fillStyle = '#08121d';
    canvas.textAlign = 'center';
    canvas.font = 'bold 42px sans-serif';
    canvas.fillText(title, 512, 115);
    canvas.font = 'bold 72px sans-serif';
    canvas.fillText(label, 512, 235);
    canvas.font = 'bold 120px sans-serif';
    canvas.fillText(String(seconds), 512, 395);
    this.texture.update();
  }
  interaction(): null {
    return null;
  }
  onShot(): void {}
  dispose(): void {
    this.board.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
