import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useSingularity } from './HeroElementDistortionProvider';
import { useThemeStore } from '@/stores/theme-store';

const BlackHoleModel = () => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/black-hole/scene.gltf');
  const { actions } = useAnimations(animations, group);
  const { isEmitting } = useSingularity();

  /**
   * PERFORMANCE FIX (Lighthouse TBT: 9.88s):
   * The previous useFrame ran scene.traverse() over the ENTIRE GLTF scene
   * graph on every single frame (~60x/sec, forever, not just during
   * loading), doing an isMesh check + a material cast + an undefined check
   * on every node, and re-writing material.transparent / alphaTest /
   * depthWrite every frame even though those never change after mount.
   * That continuous full-tree walk was a major main-thread cost.
   *
   * Fix: walk the tree exactly ONCE (when the model loads), apply the
   * static transparency fix a single time, and cache only the meshes that
   * actually have an animatable emissiveIntensity. The per-frame loop now
   * just iterates that small cached list and lerps a number — no tree
   * walking, no type-checking, no redundant writes.
   */
  const emissiveMaterials = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    if (actions && actions['Take 001']) {
      actions['Take 001'].play();
    }
  }, [actions]);

  useEffect(() => {
    const materials: THREE.MeshStandardMaterial[] = [];
    scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material) {
          // One-time fix for rectangular-edge artifacts — doesn't need to
          // be re-applied every frame, only once after the model loads.
          material.transparent = true;
          material.alphaTest = 0.05;
          material.depthWrite = false;
          if (material.emissiveIntensity !== undefined) {
            materials.push(material);
          }
        }
      }
    });
    emissiveMaterials.current = materials;
  }, [scene]);

  useFrame(() => {
    // Pulse emission with the singularity wave effect — touches only the
    // small cached list of emissive materials, not the whole scene graph.
    const targetIntensity = isEmitting ? 2.5 : 1.0;
    for (const material of emissiveMaterials.current) {
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        targetIntensity,
        0.1
      );
    }
  });

  // Scale of 1.2 fits well within the 6-unit camera distance for a cinematic feel
  return (
    <group ref={group} dispose={null} rotation={[0.2, -0.2, 0]}>
      <primitive object={scene} scale={1.2} />
    </group>
  );
};

const Scene = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  useFrame((state) => {
    if (groupRef.current) {
      // Premium Parallax Tilt
      const targetX = (state.mouse.y * Math.PI) / 10;
      const targetY = (state.mouse.x * Math.PI) / 10;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.04);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.04);

      // Gentle floating motion
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  // Calculate a stable scale based on viewport width (Three.js units)
  // On mobile/narrow viewports, we scale down slightly to prevent clipping.
  const responsiveScale = useMemo(() => {
    if (viewport.width <= 0) return 1;
    return viewport.width < 4.8 ? 0.82 : 1;
  }, [viewport.width]);

  return (
    <group ref={groupRef} scale={responsiveScale}>
      <BlackHoleModel />
    </group>
  );
};

export const Singularity3D = () => {
  return (
    <div className="w-full h-full pointer-events-none relative">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 42 }}
        /*
         * PERFORMANCE FIX: dpr was capped at [1, 2]. On a typical modern
         * phone (devicePixelRatio 3) that still means rendering at 2x —
         * 4x the pixel count of a 1x render — for a decorative background
         * element. Capping at 1.5 cuts GPU fill-rate cost substantially
         * with a negligible visual difference for this use case.
         */
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        resize={{ debounce: 0 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};

useGLTF.preload('/models/black-hole/scene.gltf');
