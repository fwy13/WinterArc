import { BLOCK, VoxelWorld } from './VoxelWorld.js';

/** Deterministic construction helpers shared by client and server. */
export class MapKit {
  constructor(readonly world: VoxelWorld, private readonly origin = [0, 0, 0]) {}

  at(x: number, y: number, z: number): MapKit {
    return new MapKit(this.world, [x + this.origin[0], y + this.origin[1], z + this.origin[2]]);
  }

  block(x: number, y: number, z: number, id: number): this {
    this.world.set(x + this.origin[0], y + this.origin[1], z + this.origin[2], id);
    return this;
  }

  fill(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, id: number): this {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) this.block(x, y, z, id);
    return this;
  }

  hollow(x: number, y: number, z: number, width: number, height: number, depth: number, id: number): this {
    if (![width, height, depth].every(n => Number.isInteger(n) && n >= 3))
      throw new Error('Hollow dimensions must be integers >= 3');
    this.fill(x, y, z, x + width - 1, y + height - 1, z + depth - 1, id);
    return this.fill(x + 1, y + 1, z + 1, x + width - 2, y + height - 2, z + depth - 2, BLOCK.AIR);
  }

  disc(x: number, y: number, z: number, radius: number, id: number): this {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++)
      for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++)
        if (Math.hypot(dx, dz) <= radius) this.block(x + dx, y, z + dz, id);
    return this;
  }

  stairs(x: number, y: number, z: number, steps: number, width = 3, id: number = BLOCK.WOOD): this {
    for (let i = 0; i < steps; i++) this.fill(x, y, z + i, x + width - 1, y + i, z + i, id);
    return this;
  }

  gift(x: number, y: number, z: number, size = 2, id: number = BLOCK.RED): this {
    this.fill(x, y, z, x + size - 1, y + size - 1, z + size - 1, id);
    return this.fill(x, y + size, z, x + size - 1, y + size, z + size - 1, BLOCK.RIBBON);
  }

  candyCane(x: number, y: number, z: number, height = 6): this {
    for (let i = 0; i < height; i++) this.block(x, y + i, z, i % 2 ? BLOCK.RED : BLOCK.SNOW);
    this.block(x + 1, y + height - 1, z, BLOCK.RED);
    return this.block(x + 2, y + height - 2, z, BLOCK.SNOW);
  }

  lamp(x: number, y: number, z: number, height = 4): this {
    this.fill(x, y, z, x, y + height - 1, z, BLOCK.DARK);
    this.block(x, y + height, z, BLOCK.GLOW);
    this.world.lamps.push([x + this.origin[0] + 0.5, y + this.origin[1] + height + 0.5, z + this.origin[2] + 0.5]);
    return this;
  }

  tree(x: number, y: number, z: number, scale = 1): this {
    const position = { x: x + this.origin[0], y: y + this.origin[1], z: z + this.origin[2] };
    this.world.trees.push({ ...position, scale });
    this.world.obstacles.push({ ...position, radius: 0.3 * scale, height: 7 * scale });
    return this;
  }
}
