'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createBoltMaterials, createSparkShaderMaterial } from './shaders/thunderbolt.shaders';
import {
  type ActiveBolt,
  DEFAULT_FLICKER_PATTERN,
  disposeBolt,
  generateNaturalStrikePaths,
} from './shaders/lightning-geometry';

export interface ThunderboltBackgroundProps {
  className?: string;
  subtle?: boolean;
  particleCount?: number;
  minInterval?: number;
  maxInterval?: number;
}

export function ThunderboltBackground({
  className = '',
  subtle = false,
  particleCount: customParticleCount,
  minInterval: customMinInterval,
  maxInterval: customMaxInterval,
}: ThunderboltBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flashOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const flashOverlay = flashOverlayRef.current;
    if (!container) return;

    let animationFrameId: number;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.z = 200;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'default',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    let visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
    let visibleWidth = visibleHeight * camera.aspect;

    const lightningLight = new THREE.PointLight(0xe8364b, 0, 450, 1.2);
    scene.add(lightningLight);

    const activeBolts: ActiveBolt[] = [];

    function triggerNaturalStrike() {
      const now = performance.now();
      const { start, allPaths } = generateNaturalStrikePaths(visibleWidth, visibleHeight, subtle);

      const boltLines: THREE.Line[] = [];
      const boltMaterials: THREE.LineBasicMaterial[] = [];
      const glowLines: THREE.Line[] = [];
      const glowMaterials: THREE.LineBasicMaterial[] = [];

      for (const { points, depth } of allPaths) {
        const { coreMat, glowMat } = createBoltMaterials(depth, subtle);

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, coreMat);
        scene.add(line);
        boltLines.push(line);
        boltMaterials.push(coreMat);

        const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
        const glowLine = new THREE.Line(glowGeo, glowMat);
        scene.add(glowLine);
        glowLines.push(glowLine);
        glowMaterials.push(glowMat);
      }

      const duration = (subtle ? 240 : 280) + Math.random() * 90;

      activeBolts.push({
        lines: boltLines,
        materials: boltMaterials,
        glowLines,
        glowMaterials,
        startTime: now,
        duration,
        flickerPattern: DEFAULT_FLICKER_PATTERN,
        origin: start,
      });

      lightningLight.position.copy(start);
      lightningLight.intensity = subtle ? 1.8 : 3.5;

      if (flashOverlay) {
        const baseFlash = subtle ? 0.09 : 0.18;
        flashOverlay.style.opacity = (baseFlash + Math.random() * (subtle ? 0.06 : 0.12)).toString();
        setTimeout(() => {
          if (flashOverlay) flashOverlay.style.opacity = subtle ? '0.02' : '0.04';
        }, 50);
        setTimeout(() => {
          if (flashOverlay) flashOverlay.style.opacity = (baseFlash * 0.6).toString();
        }, 110);
        setTimeout(() => {
          if (flashOverlay) flashOverlay.style.opacity = '0';
        }, 220);
      }
    }

    // Ambient Ionized Sparks via custom GLSL shader material
    const particleCount = customParticleCount ?? (subtle ? 110 : 130);
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * (visibleWidth * 1.15);
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * (visibleHeight * 1.15);
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 60;

      particleVelocities.push({
        x: (Math.random() - 0.5) * (subtle ? 0.16 : 0.22),
        y: Math.random() * (subtle ? 0.28 : 0.38) + 0.08,
        z: (Math.random() - 0.5) * 0.12,
      });
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = createSparkShaderMaterial(subtle);
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const minWait = customMinInterval ?? (subtle ? 4000 : 2200);
    const maxWait = customMaxInterval ?? (subtle ? 9000 : 5500);
    let nextStrikeTime = performance.now() + (subtle ? 2000 : 1200);

    function scheduleNextStrike(now: number) {
      if (Math.random() < (subtle ? 0.18 : 0.28)) {
        return now + 200 + Math.random() * 300;
      }
      return now + minWait + Math.random() * (maxWait - minWait);
    }

    let isVisible = true;
    let isRunning = false;

    const animate = (currentTime: number) => {
      if (!isVisible || document.hidden) {
        isRunning = false;
        return;
      }
      isRunning = true;
      animationFrameId = requestAnimationFrame(animate);

      if (currentTime >= nextStrikeTime) {
        triggerNaturalStrike();
        nextStrikeTime = scheduleNextStrike(currentTime);
      }

      for (let i = activeBolts.length - 1; i >= 0; i--) {
        const bolt = activeBolts[i];
        const elapsed = currentTime - bolt.startTime;
        const progress = elapsed / bolt.duration;

        if (progress >= 1.0) {
          disposeBolt(scene, bolt);
          activeBolts.splice(i, 1);
          if (activeBolts.length === 0) {
            lightningLight.intensity = 0;
          }
        } else {
          const patternIdx = Math.min(
            bolt.flickerPattern.length - 1,
            Math.floor(progress * bolt.flickerPattern.length)
          );
          const rawIntensity = bolt.flickerPattern[patternIdx];
          const jitter = Math.random() > 0.15 ? 1.0 : 0.4;
          const currentOpacity = rawIntensity * jitter * (1 - progress * 0.6) * (subtle ? 0.75 : 1.0);

          bolt.materials.forEach((m) => {
            m.opacity = Math.max(0, currentOpacity);
          });
          bolt.glowMaterials.forEach((gm) => {
            gm.opacity = Math.max(0, currentOpacity * 0.85);
          });

          lightningLight.intensity = currentOpacity * (subtle ? 1.8 : 3.0);
        }
      }

      const positions = particleGeometry.attributes.position.array as Float32Array;
      const halfH = visibleHeight * 0.58;
      const halfW = visibleWidth * 0.58;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        positions[idx] += particleVelocities[i].x;
        positions[idx + 1] += particleVelocities[i].y;
        positions[idx + 2] += particleVelocities[i].z;

        if (positions[idx + 1] > halfH) {
          positions[idx + 1] = -halfH;
          positions[idx] = (Math.random() - 0.5) * (visibleWidth * 1.15);
        }
        if (Math.abs(positions[idx]) > halfW) {
          positions[idx] = (Math.random() - 0.5) * (visibleWidth * 1.15);
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    const resumeLoop = () => {
      if (!isRunning && isVisible && !document.hidden) {
        nextStrikeTime = Math.max(nextStrikeTime, performance.now() + 800);
        isRunning = true;
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
        if (isVisible) {
          resumeLoop();
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(container);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resumeLoop();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
      visibleWidth = visibleHeight * camera.aspect;
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      activeBolts.forEach((b) => disposeBolt(scene, b));

      scene.remove(particles);
      particleGeometry.dispose();
      particleMaterial.dispose();
      scene.remove(lightningLight);

      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [subtle, customParticleCount, customMinInterval, customMaxInterval]);

  return (
    <>
      <div
        ref={containerRef}
        className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
        aria-hidden="true"
      />
      <div
        ref={flashOverlayRef}
        className="absolute inset-0 pointer-events-none select-none bg-[radial-gradient(ellipse_at_center,rgba(232,54,75,0.35)_0%,rgba(20,2,8,0.15)_60%,transparent_100%)] opacity-0 transition-opacity duration-75 z-0"
        aria-hidden="true"
      />
    </>
  );
}
