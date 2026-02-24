import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
  Environment,
  OrbitControls,
  useAnimations,
  useGLTF,
  ContactShadows,
} from "@react-three/drei";

function Model({ url, isWireframe, isTransparent, explodeT, onHasAnimations }) {
  const groupRef = useRef();

  // Carga GLB remoto
  const { scene, animations } = useGLTF(url);
  const { mixer } = useAnimations(animations, groupRef);

  useEffect(() => {
    onHasAnimations?.(!!animations?.length);
  }, [animations, onHasAnimations]);

  // Clonar escena + materiales para no mutar el cache interno de useGLTF
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = obj.material.clone();
      }
    });
    return cloned;
  }, [scene]);

  // Aplicar wireframe/transparencia
  useEffect(() => {
    clonedScene.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;

      obj.material.wireframe = !!isWireframe;

      obj.material.transparent = !!isTransparent;
      obj.material.opacity = isTransparent ? 0.25 : 1;
      obj.material.depthWrite = !isTransparent;
      obj.material.needsUpdate = true;
    });
  }, [clonedScene, isWireframe, isTransparent]);

  // Control simple de animación (explode) si el GLB trae clips
  useEffect(() => {
    if (!animations?.length || !mixer) return;
    const clip = animations[0];
    const duration = clip.duration || 1;
    mixer.setTime(duration * explodeT);
  }, [animations, mixer, explodeT]);

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </group>
  );
}

export default function Ensamble3DViewer({
  url,
  isWireframe,
  isTransparent,
  explodeT,
  onHasAnimations,
  controlsRef,
}) {
  return (
    <div style={{ width: "100%", height: "70vh", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
      <Canvas
        shadows
        camera={{ position: [4, 3, 4], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />

          <directionalLight
            position={[6, 10, 6]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />

          {/* Look “pro” */}
          <Environment preset="warehouse" />

          {/* Ajuste automático al modelo */}
          <Bounds fit clip observe margin={1.2}>
            <Model
              key={url} // importante para recargar al cambiar de modelo
              url={url}
              isWireframe={isWireframe}
              isTransparent={isTransparent}
              explodeT={explodeT}
              onHasAnimations={onHasAnimations}
            />
          </Bounds>

          {/* Sombra de contacto para sensación de “producto real” */}
          <ContactShadows position={[0, -1.2, 0]} opacity={0.5} blur={2} />

          <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// (Opcional) precarga si quieres:
// useGLTF.preload("https://storage.googleapis.com/sira-ensambles-public/carrito.glb");
// useGLTF.preload("https://storage.googleapis.com/sira-ensambles-public/ensamblaje_riel_final.glb");