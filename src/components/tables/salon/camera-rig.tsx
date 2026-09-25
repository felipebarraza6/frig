"use client";

import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { SalonFocus } from "./venue-screens";

/* ------------------------------------------------------------------ */
/* Cámara: orbita suave con límites amplios (casi horizonte para      */
/* mirar a todos lados, zoom bien cerca para leer la pantalla de      */
/* cocina) + vuelo cinematográfico hacia los hotspots.                */
/* ------------------------------------------------------------------ */

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface CameraRigProps {
  mode: "edit" | "select";
  camDist: number;
  /** Destino de vuelo activo (null = control libre). */
  focus: SalonFocus | null;
  /** Se llama al terminar o cancelarse el vuelo. */
  onFocusSettled: () => void;
  /** Cambia para volver a la vista general. */
  homeSignal: number;
}

export function CameraRig({
  mode,
  camDist,
  focus,
  onFocusSettled,
  homeSignal,
}: CameraRigProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const { camera } = useThree();
  const anim = useRef<{
    t: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);
  const settledRef = useRef(onFocusSettled);
  useEffect(() => {
    settledRef.current = onFocusSettled;
  }, [onFocusSettled]);

  const home: SalonFocus = useMemo(
    () => ({
      camPos: [camDist * 0.7, camDist * 0.75, camDist * 0.7],
      target: [0, 0.6, 0],
    }),
    [camDist],
  );

  const flyTo = (f: SalonFocus) => {
    const controls = controlsRef.current;
    if (!controls) return;
    anim.current = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...f.camPos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...f.target),
    };
  };

  // Vuelo hacia hotspot
  useEffect(() => {
    if (focus) flyTo(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar destino
  }, [focus]);

  // Vuelo de regreso a casa
  useEffect(() => {
    if (homeSignal > 0) flyTo(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- señal
  }, [homeSignal]);

  useFrame((_, dt) => {
    const a = anim.current;
    const controls = controlsRef.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 1.15);
    const k = easeInOutCubic(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    controls.update();
    if (a.t >= 1) {
      anim.current = null;
      settledRef.current();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      panSpeed={0.7}
      zoomSpeed={1.1}
      enablePan={mode !== "edit"}
      enableRotate={mode !== "edit"}
      enableZoom
      screenSpacePanning={false}
      minPolarAngle={0.12}
      maxPolarAngle={1.52}
      minDistance={1.8}
      maxDistance={Math.max(55, camDist * 2.8)}
      target={[0, 0.6, 0]}
      onStart={() => {
        // El usuario toma el control: cancela cualquier vuelo
        if (anim.current) {
          anim.current = null;
          settledRef.current();
        }
      }}
    />
  );
}
