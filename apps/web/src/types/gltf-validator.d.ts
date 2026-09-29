declare module 'gltf-validator' {
  export function validateBytes(
    data: Uint8Array,
    options: { uri: string },
  ): Promise<{
    issues: { numErrors: number; numWarnings: number; messages: unknown[] };
  }>;
}
