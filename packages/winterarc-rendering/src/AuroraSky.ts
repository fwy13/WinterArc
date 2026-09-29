import type { Scene } from '@babylonjs/core/scene.js';
import type { Observer } from '@babylonjs/core/Misc/observable.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import type { SkyQuality } from 'winterarc-core';

const vertexSource = `
precision highp float;
attribute vec3 position;
uniform mat4 view;
uniform mat4 projection;
varying vec3 skyDirection;
void main(void) {
  skyDirection = position;
  // Strip camera translation: the sky has no parallax and cannot be approached.
  vec4 clip = projection * vec4(mat3(view) * position, 1.0);
  gl_Position = vec4(clip.xy, clip.w * 0.99999, clip.w);
}
`;

const fragmentSource = `
precision highp float;
varying vec3 skyDirection;
uniform float time;
uniform float detail;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float curtain(vec3 d, float shift) {
  // Continuous directional coordinates avoid a seam at the longitude boundary.
  float x = d.x * 2.8 + d.z * 1.6 + shift;
  float center = 0.32 + 0.13 * sin(x * 1.7 + time * 0.12)
    + 0.055 * sin(x * 4.3 - time * 0.08 + shift);
  float height = d.y - center;
  float envelope = smoothstep(-0.025, 0.025, height)
    * (1.0 - smoothstep(0.06, 0.38, height));
  float threads = 0.57 + 0.28 * sin(x * 76.0 + time * 0.22)
    + 0.15 * sin(x * 139.0 - time * 0.3);
  return envelope * threads;
}
void main(void) {
  vec3 d = normalize(skyDirection);
  float elevation = smoothstep(-0.12, 0.8, d.y);
  vec3 color = mix(vec3(0.105, 0.19, 0.25), vec3(0.012, 0.025, 0.075), elevation);
  float visible = smoothstep(0.02, 0.2, d.y);
  float band = curtain(d, 0.0);
  if (detail > 1.5) {
    band += curtain(d, 1.7) * 0.42;
    band += curtain(d, -2.8) * 0.23;
  }
  vec3 glow = mix(vec3(0.10, 0.9, 0.53), vec3(0.37, 0.24, 0.85), smoothstep(0.3, 0.85, d.y));
  color += glow * band * visible * 0.55;
  // Sparse static stars, no textures or per-star meshes.
  vec2 starUV = vec2(atan(d.z, d.x) * 90.0, asin(clamp(d.y, -1.0, 1.0)) * 90.0);
  vec2 cell = floor(starUV);
  float seed = hash(cell);
  vec2 delta = fract(starUV) - vec2(0.5);
  float star = (1.0 - smoothstep(0.015, 0.095, length(delta))) * step(0.991, seed);
  color += vec3(0.72, 0.82, 1.0) * star * visible;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** One opaque sky draw; no textures, lights, physics, network state or postprocessing.
 * ShaderMaterial source strings: https://doc.babylonjs.com/features/featuresDeepDive/materials/shaders/shaderMaterial/
 */
export class AuroraSky {
  private readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly observer: Observer<Scene>;
  private readonly reducedMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private animated = false;
  private elapsed = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    quality: SkyQuality = 'auto',
    register?: (mesh: Mesh) => void,
  ) {
    this.material = new ShaderMaterial('aurora-sky-material', scene,
      { vertexSource, fragmentSource },
      { attributes: ['position'], uniforms: ['view', 'projection', 'time', 'detail'] },
    );
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.material.fogEnabled = false;
    this.mesh = CreateSphere('aurora-sky', { diameter: 2, segments: 16 }, scene);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.infiniteDistance = true;
    this.mesh.applyFog = false;
    this.mesh.receiveShadows = false;
    // noa uses an octree; its adapter must register this as a dynamic mesh.
    register?.(this.mesh);
    this.setQuality(quality);
    // Runs only when the owning scene renders; paused previews do no sky work.
    this.observer = scene.onBeforeRenderObservable.add(() => this.update())!;
  }

  setQuality(quality: SkyQuality): void {
    if (this.disposed) return;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const effective = quality === 'auto' ? (coarse || this.reducedMotion ? 'low' : 'high') : quality;
    this.mesh.setEnabled(effective !== 'off');
    this.animated = effective === 'high' && !this.reducedMotion;
    this.material.setFloat('detail', effective === 'high' ? 3 : 1);
    this.material.setFloat('time', this.animated ? this.elapsed : 0);
  }

  update(): void {
    if (this.disposed || !this.mesh.isEnabled()) return;
    if (this.animated) {
      this.elapsed += Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
      this.material.setFloat('time', this.elapsed);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.mesh.dispose();
    this.material.dispose();
  }
}
