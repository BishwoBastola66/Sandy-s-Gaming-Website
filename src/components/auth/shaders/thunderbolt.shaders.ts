import * as THREE from 'three';

/**
 * Custom GLSL shaders & material helpers for WebGL atmospheric plasma particles
 * and ionized lightning bolts in ThunderboltBackground.
 */

export const SPARK_VERTEX_SHADER = /* glsl */ `
  uniform float uSize;
  varying float vDepthAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (200.0 / -mvPosition.z);
    vDepthAlpha = clamp(1.0 - abs(position.z) / 80.0, 0.25, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const SPARK_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vDepthAlpha;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float radialGlow = smoothstep(0.5, 0.05, dist);
    gl_FragColor = vec4(uColor, uOpacity * radialGlow * vDepthAlpha);
  }
`;

export function createSparkShaderMaterial(subtle: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff3b57) },
      uSize: { value: subtle ? 3.2 : 4.0 },
      uOpacity: { value: subtle ? 0.5 : 0.68 },
    },
    vertexShader: SPARK_VERTEX_SHADER,
    fragmentShader: SPARK_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createBoltMaterials(depth: number, subtle: boolean) {
  const maxCoreOpacity = subtle ? 0.75 : 1.0;
  const maxGlowOpacity = subtle ? 0.65 : 0.9;

  const coreMat = new THREE.LineBasicMaterial({
    color: depth === 0 ? 0xffffff : 0xffc4cc,
    transparent: true,
    opacity: maxCoreOpacity,
    blending: THREE.AdditiveBlending,
    linewidth: depth === 0 ? (subtle ? 1.5 : 2) : 1,
  });

  const glowMat = new THREE.LineBasicMaterial({
    color: depth === 0 ? 0xe8364b : 0xd12a3e,
    transparent: true,
    opacity: depth === 0 ? maxGlowOpacity : maxGlowOpacity * 0.7,
    blending: THREE.AdditiveBlending,
    linewidth: depth === 0 ? (subtle ? 3 : 4) : 2,
  });

  return { coreMat, glowMat };
}

