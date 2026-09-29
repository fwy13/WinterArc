import { BLOCK_TEXTURES } from 'winterarc-rendering';
import type { Engine } from 'noa-engine';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PALETTE, BLOCK, blockShape } from 'winterarc-world';
/** Local tileable PNGs, registered once; noa handles the actual chunk materials. */
export class TextureManager {
  register(noa: Engine): void {
    for (const [id, [name, color]] of Object.entries(PALETTE)) {
      if (!blockShape(Number(id)).fullCube) {
        // No cube geometry/occlusion for slab/stair/torch. Meshes are batched separately.
        noa.registry.registerBlock(Number(id), { solid: false, opaque: false });
        continue;
      }
      const file = BLOCK_TEXTURES[Number(id)];
      noa.registry.registerMaterial(
        name,
        file
          ? { textureURL: `/textures/${file}.png`, color: [1, 1, 1] }
          : { color: Color3.FromHexString(color).asArray() },
      );
      noa.registry.registerBlock(Number(id), { material: name });
    }
    noa.registry.registerMaterial('snow-side', {
      textureURL: '/textures/snow-side.png',
      color: [1, 1, 1],
    });
    noa.registry.registerBlock(BLOCK.SNOW, {
      material: ['snow', 'earth', 'snow-side'],
    });
  }
}
