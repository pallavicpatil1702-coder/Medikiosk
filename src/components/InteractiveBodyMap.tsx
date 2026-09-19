"use client";

import React, { useState, Suspense, useRef, useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { RefreshCw, Brush, Eraser, X } from 'lucide-react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, Center, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

import { BodyLocation, PatientSession } from '../lib/types';
import { FRONT_REGIONS, BACK_REGIONS } from '../lib/regions';

type Mode = 'rotate' | 'paint' | 'erase';

const ALL_REGIONS = [...FRONT_REGIONS, ...BACK_REGIONS];

const REGION_CENTERS: Record<string, [number, number, number]> = {
  head: [0, 1.65, 0.1],
  face: [0, 1.65, 0.1],
  neck: [0, 1.5, 0.1],
  left_shoulder: [0.2, 1.35, 0.1],
  right_shoulder: [-0.2, 1.35, 0.1],
  chest: [0, 1.3, 0.1],
  upper_abdomen: [0, 1.1, 0.1],
  lower_abdomen: [0, 0.9, 0.1],
  pelvis: [0, 0.9, 0.1],
  left_upper_arm: [0.3, 1.2, 0.1],
  right_upper_arm: [-0.3, 1.2, 0.1],
  left_elbow: [0.2, 1.0, 0.1],
  right_elbow: [-0.2, 1.0, 0.1],
  left_forearm: [0.3, 0.9, 0.1],
  right_forearm: [-0.3, 0.9, 0.1],
  left_hand: [0.3, 0.7, 0.1],
  right_hand: [-0.3, 0.7, 0.1],
  left_thigh: [0.1, 0.5, 0.1],
  right_thigh: [-0.1, 0.5, 0.1],
  left_knee: [0.1, 0.35, 0.1],
  right_knee: [-0.1, 0.35, 0.1],
  left_lower_leg: [0.1, 0.2, 0.1],
  right_lower_leg: [-0.1, 0.2, 0.1],
  left_foot: [0.1, 0.05, 0.1],
  right_foot: [-0.1, 0.05, 0.1],
  head_back: [0, 1.65, -0.1],
  neck_back: [0, 1.5, -0.1],
  upper_back: [0, 1.3, -0.1],
  lower_back: [0, 1.1, -0.1],
  pelvis_back: [0, 0.9, -0.1],
  left_shoulder_back: [0.2, 1.35, -0.1],
  right_shoulder_back: [-0.2, 1.35, -0.1],
  left_upper_arm_back: [0.3, 1.2, -0.1],
  right_upper_arm_back: [-0.3, 1.2, -0.1],
  left_elbow_back: [0.2, 1.0, -0.1],
  right_elbow_back: [-0.2, 1.0, -0.1],
  left_forearm_back: [0.3, 0.9, -0.1],
  right_forearm_back: [-0.3, 0.9, -0.1],
  left_hand_back: [0.3, 0.7, -0.1],
  right_hand_back: [-0.3, 0.7, -0.1],
  left_thigh_back: [0.1, 0.5, -0.1],
  right_thigh_back: [-0.1, 0.5, -0.1],
  left_knee_back: [0.1, 0.35, -0.1],
  right_knee_back: [-0.1, 0.35, -0.1],
  left_lower_leg_back: [0.1, 0.2, -0.1],
  right_lower_leg_back: [-0.1, 0.2, -0.1],
  left_foot_back: [0.1, 0.05, -0.1],
  right_foot_back: [-0.1, 0.05, -0.1]
};

function getRegionFromPoint(pt: THREE.Vector3, cameraPos: THREE.Vector3): string {
  const { x, y } = pt;
  const isFront = cameraPos.z > 0;
  const getSuffix = (base: string, backSuffix: string = '_back') => isFront ? base : `${base}${backSuffix}`;
  const absX = Math.abs(x);

  // Arms (A-pose: hanging down diagonally)
  if (absX > 0.18) {
    if (y > 1.4) return getSuffix(x > 0 ? 'left_shoulder' : 'right_shoulder');
    if (y > 1.15) return getSuffix(x > 0 ? 'left_upper_arm' : 'right_upper_arm');
    if (y > 1.05) return getSuffix(x > 0 ? 'left_elbow' : 'right_elbow');
    if (y > 0.85) return getSuffix(x > 0 ? 'left_forearm' : 'right_forearm');
    if (y > 0.6) return getSuffix(x > 0 ? 'left_hand' : 'right_hand');
    // If hand is hanging very low
    if (y <= 0.6 && absX > 0.25) return getSuffix(x > 0 ? 'left_hand' : 'right_hand');
  }

  // Head and Neck
  if (y > 1.65) {
    if (x > 0.05) return getSuffix('left_head');
    if (x < -0.05) return getSuffix('right_head');
    return getSuffix('center_head');
  }
  if (y > 1.55) { // Jaw / Nape area
    if (x > 0.05) return isFront ? 'left_jaw' : 'left_neck_back';
    if (x < -0.05) return isFront ? 'right_jaw' : 'right_neck_back';
    return isFront ? 'jaw' : 'nape';
  }
  if (y > 1.48) {
    if (x > 0.04) return getSuffix('left_neck');
    if (x < -0.04) return getSuffix('right_neck');
    return getSuffix('neck');
  }

  // Torso
  if (y > 1.35) {
    if (x > 0.06) return isFront ? 'left_chest' : 'left_upper_back';
    if (x < -0.06) return isFront ? 'right_chest' : 'right_upper_back';
    return isFront ? 'center_chest' : 'center_upper_back';
  }
  if (y > 1.15) {
    if (x > 0.06) return isFront ? 'left_upper_abdomen' : 'left_middle_back';
    if (x < -0.06) return isFront ? 'right_upper_abdomen' : 'right_middle_back';
    return isFront ? 'center_upper_abdomen' : 'center_middle_back';
  }
  if (y > 0.95) {
    if (x > 0.06) return isFront ? 'left_lower_abdomen' : 'left_lower_back';
    if (x < -0.06) return isFront ? 'right_lower_abdomen' : 'right_lower_back';
    return isFront ? 'center_lower_abdomen' : 'center_lower_back';
  }
  if (y > 0.8) {
    if (x > 0.06) return isFront ? 'left_pelvis' : 'left_pelvis_back';
    if (x < -0.06) return isFront ? 'right_pelvis' : 'right_pelvis_back';
    return isFront ? 'center_pelvis' : 'center_pelvis_back';
  }

  // Legs (y <= 0.8)
  if (y > 0.45) {
    if (x > 0) return getSuffix('left_thigh');
    return getSuffix('right_thigh');
  }
  if (y > 0.3) {
    if (x > 0) return getSuffix('left_knee');
    return getSuffix('right_knee');
  }
  if (y > 0.1) {
    if (x > 0) return getSuffix('left_lower_leg');
    return getSuffix('right_lower_leg');
  }
  
  if (x > 0) return getSuffix('left_foot');
  return getSuffix('right_foot');
}

function HumanModel({ 
  mode, 
  selectedLocations, 
  onPaint,
  onErase
}: { 
  mode: Mode, 
  selectedLocations: BodyLocation[],
  onPaint: (id: string, pt: THREE.Vector3) => void,
  onErase: (pt: THREE.Vector3) => void
}) {
  const { scene } = useGLTF('/human.glb');
  const { camera } = useThree();
  const isDraggingRef = useRef(false);

  React.useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#0a5cff"),
          emissive: new THREE.Color("#002166"),
          roughness: 0.1,
          metalness: 0.8,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.95,
        });
      }
    });
  }, [scene]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    if (mode === 'paint' || mode === 'erase') {
      const normalizedPt = new THREE.Vector3(e.point.x, e.point.y + 0.9, e.point.z);
      if (mode === 'paint') {
        const regionId = getRegionFromPoint(normalizedPt, camera.position);
        onPaint(regionId, normalizedPt);
      } else {
        onErase(normalizedPt);
      }
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDraggingRef.current) return;
    if (mode === 'paint' || mode === 'erase') {
      const normalizedPt = new THREE.Vector3(e.point.x, e.point.y + 0.9, e.point.z);
      if (mode === 'paint') {
        const regionId = getRegionFromPoint(normalizedPt, camera.position);
        onPaint(regionId, normalizedPt);
      } else {
        onErase(normalizedPt);
      }
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <group>
      <primitive 
        object={scene} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
      />
      
      {/* Render pencil marks using standard meshes for reliable reactivity */}
      {selectedLocations.map((loc) => {
        if (!loc.paintedPoints || loc.paintedPoints.length === 0) {
          // Fallback for regions without points (e.g. from previous sessions)
          const center = REGION_CENTERS[loc.id];
          if (!center) return null;
          return (
            <mesh key={`${loc.id}-center`} position={center} scale={3}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
            </mesh>
          );
        }
        return loc.paintedPoints.map((pt, i) => (
          <mesh key={`${loc.id}-${i}`} position={pt}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
          </mesh>
        ));
      })}
    </group>
  );
}

// Preload to avoid pop-in
useGLTF.preload('/human.glb');

interface InteractiveBodyMapProps {
  selectedLocations: BodyLocation[];
  onChange: (locations: BodyLocation[]) => void;
}

export default function InteractiveBodyMap({ selectedLocations = [], onChange }: InteractiveBodyMapProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('paint');
  const latestLocationsRef = useRef(selectedLocations);

  useEffect(() => {
    latestLocationsRef.current = selectedLocations;
  }, [selectedLocations]);

  const handlePaint = (id: string, pt: THREE.Vector3) => {
    const currentLocations = latestLocationsRef.current;
    const existingIdx = currentLocations.findIndex(l => l.id === id);
    let newLocations;

    if (existingIdx === -1) {
      const region = ALL_REGIONS.find(r => r.id === id);
      if (region) {
        const view = FRONT_REGIONS.some(r => r.id === id) ? 'front' : 'back';
        newLocations = [...currentLocations, { 
          ...region, 
          view,
          paintedPoints: [[pt.x, pt.y, pt.z]]
        } as BodyLocation];
      } else {
        return;
      }
    } else {
      const existingPoints = currentLocations[existingIdx].paintedPoints || [];
      const lastPoint = existingPoints[existingPoints.length - 1];
      if (!lastPoint || new THREE.Vector3(...lastPoint).distanceTo(pt) > 0.005) {
        newLocations = [...currentLocations];
        newLocations[existingIdx] = {
          ...newLocations[existingIdx],
          paintedPoints: [...existingPoints, [pt.x, pt.y, pt.z]]
        };
      } else {
        return; // Point is too close to the last one, don't update
      }
    }
    
    latestLocationsRef.current = newLocations;
    onChange(newLocations);
  };

  const handleErase = (pt: THREE.Vector3) => {
    const ERASE_RADIUS = 0.06; // 6cm eraser
    let changed = false;
    const currentLocations = latestLocationsRef.current;
    
    const newLocations = currentLocations.map(loc => {
      if (!loc.paintedPoints) return loc;
      const remainingPoints = loc.paintedPoints.filter(p => {
        return new THREE.Vector3(...p).distanceTo(pt) > ERASE_RADIUS;
      });
      if (remainingPoints.length !== loc.paintedPoints.length) {
        changed = true;
      }
      return { ...loc, paintedPoints: remainingPoints };
    }).filter(loc => !loc.paintedPoints || loc.paintedPoints.length > 0);

    if (changed) {
      latestLocationsRef.current = newLocations;
      onChange(newLocations);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl mx-auto">
      {/* 3D Map Section */}
      <div className="w-full md:w-1/2 flex flex-col items-center">
        {/* Controls */}
        <div className="flex items-center gap-2 mb-4 bg-white p-2 rounded-2xl shadow-sm border border-[#e2e8f0] w-full max-w-[320px]">
          <button
            onClick={() => setMode('rotate')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              mode === 'rotate' 
                ? 'bg-[#2563eb] text-white shadow-md' 
                : 'text-[#475569] hover:bg-[#ede5d6]'
            }`}
          >
            <RefreshCw size={18} /> {t('Rotate')}
          </button>
          <button
            onClick={() => setMode('paint')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              mode === 'paint' 
                ? 'bg-[#2563eb] text-white shadow-md' 
                : 'text-[#475569] hover:bg-[#ede5d6]'
            }`}
          >
            <Brush size={18} /> {t('Paint')}
          </button>
          <button
            onClick={() => setMode('erase')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              mode === 'erase' 
                ? 'bg-[#2563eb] text-white shadow-md' 
                : 'text-[#475569] hover:bg-[#ede5d6]'
            }`}
          >
            <Eraser size={18} /> {t('Erase')}
          </button>
        </div>

        {/* 3D Canvas */}
        <div className="relative w-full max-w-[320px] aspect-[1/1.5] rounded-[24px] overflow-hidden touch-none" style={{ touchAction: 'none' }}>
          <Canvas camera={{ position: [0, 0.9, 2.2], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            <Environment preset="city" />
            
            <Suspense fallback={null}>
              <group position={[0, -0.9, 0]}>
                <HumanModel 
                  mode={mode} 
                  selectedLocations={selectedLocations} 
                  onPaint={handlePaint}
                  onErase={handleErase}
                />
              </group>
              <ContactShadows position={[0, -0.9, 0]} opacity={0.4} scale={10} blur={2} far={4} />
            </Suspense>
            
            <OrbitControls 
              enableZoom={false} 
              enablePan={false}
              enabled={mode === 'rotate'}
            />
          </Canvas>
          
          {/* Overlay to catch pointer events if not rotating, to ensure smooth painting */}
          {mode !== 'rotate' && (
            <div className="absolute inset-0 pointer-events-none" />
          )}
        </div>
        
        {/* Status Text */}
        <div className="text-center text-[13px] text-[#64748b] mt-4 font-medium">
          {mode === 'rotate' && t('Rotate mode: drag to turn')}
          {mode === 'paint' && t('Paint mode: drag over affected area')}
          {mode === 'erase' && t('Erase mode: drag over selected area')}
        </div>
      </div>

      {/* Selected Items Section */}
      <div className="w-full md:w-1/2 bg-[#f8fafc] border border-[#e2e8f0] rounded-[24px] p-6 min-h-[300px] flex flex-col shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e2e8f0]">
          <h3 className="text-lg font-bold text-[#0f172a]">{t('Selected Areas')}</h3>
          {selectedLocations.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-xs font-bold text-[#b91c1c] hover:bg-[#fef2f2] bg-white px-3 py-1.5 rounded-lg border border-[#fecaca] transition shadow-sm"
            >
              {t('Clear All')}
            </button>
          )}
        </div>

        <div className="flex-1">
          {selectedLocations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#64748b] text-sm py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-[#f1f5f9] flex items-center justify-center">
                <Brush size={20} className="text-[#94a3b8]" />
              </div>
              <p>{t('No areas selected.')}</p>
              <p className="text-xs">{t('Switch to Paint mode and drag on the body.')}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedLocations.map((loc) => (
                <div 
                  key={loc.id}
                  className="flex items-center gap-2 bg-white border border-[#cbd5e1] px-3 py-2 rounded-xl text-sm font-medium text-[#334155] shadow-sm animate-fade-in"
                >
                  <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
                  {t(loc.name)}
                  <button 
                    onClick={() => onChange(selectedLocations.filter(l => l.id !== loc.id))}
                    className="ml-1 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fef2f2] rounded-md p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
