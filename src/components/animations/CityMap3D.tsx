import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Html, Environment } from "@react-three/drei"
import * as THREE from "three"

/* ══════════════════════════════════════════════════════════════════════════
   PREMIUM 3D CITY — Compact Zoomed View
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Immeuble avec fenêtres 3D ── */
function TowerWithWindows({
  position,
  width,
  height,
  depth,
  rows = 6,
  cols = 3,
}: {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  rows?: number
  cols?: number
}) {
  const facadeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1A2232", roughness: 0.4, metalness: 0.7 }),
    [],
  )
  const windowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#FDE047",
        emissive: "#EAB308",
        emissiveIntensity: 2.0,
        roughness: 0.1,
      }),
    [],
  )

  const windowPositions = useMemo(() => {
    const points: [number, number, number][] = []
    const startX = -width / 2 + 0.2
    const endX = width / 2 - 0.2
    const startY = -height / 2 + 0.4
    const endY = height / 2 - 0.4
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + (c * (endX - startX)) / (cols - 1 || 1)
        const y = startY + (r * (endY - startY)) / (rows - 1 || 1)
        if (Math.random() > 0.35) points.push([x, y, depth / 2 + 0.01])
      }
    }
    return points
  }, [width, height, depth, rows, cols])

  return (
    <group position={position}>
      <mesh castShadow receiveShadow material={facadeMaterial}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      {windowPositions.map((pos, i) => (
        <mesh key={i} position={pos} material={windowMaterial}>
          <boxGeometry args={[0.14, 0.2, 0.02]} />
        </mesh>
      ))}
    </group>
  )
}

/* ── Pavillon moderne ── */
function ModernArchitecturalHouse({
  position,
  rotationY = 0,
}: {
  position: [number, number, number]
  rotationY?: number
}) {
  const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E2E8F0", roughness: 0.5 }), [])
  const accentWallMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.7 }), [])
  const roofMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1E293B", roughness: 0.5 }), [])
  const lightWindowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#FEF08A",
        emissive: "#F59E0B",
        emissiveIntensity: 1.5,
      }),
    [],
  )

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.25, 0]} material={wallMaterial} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.5, 0.9]} />
      </mesh>
      <mesh position={[-0.2, 0.65, 0.05]} material={accentWallMaterial} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.8]} />
      </mesh>
      <mesh position={[0.2, 0.5, 0]} rotation={[0, 0, -0.15]} material={roofMaterial} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.95]} />
      </mesh>
      <mesh position={[-0.2, 0.65, 0.46]} material={lightWindowMaterial}>
        <boxGeometry args={[0.4, 0.18, 0.02]} />
      </mesh>
      <mesh position={[0.2, 0.25, 0.46]} material={lightWindowMaterial}>
        <boxGeometry args={[0.5, 0.3, 0.02]} />
      </mesh>
    </group>
  )
}

/* ── Atelier à toit oblique ── */
function ObliqueWorkshopBuilding({
  position,
  rotationY = 0,
}: {
  position: [number, number, number]
  rotationY?: number
}) {
  const brickMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.6 }), [])
  const roofMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7F1D1D", roughness: 0.4 }), [])
  const doorMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#94A3B8", roughness: 0.3 }), [])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.35, 0]} material={brickMaterial} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.7, 1.3]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[0.18, 0, 0]} material={roofMaterial} castShadow>
        <boxGeometry args={[1.4, 0.06, 1.4]} />
      </mesh>
      <mesh position={[0, 0.25, 0.66]} material={doorMaterial}>
        <boxGeometry args={[0.7, 0.5, 0.02]} />
      </mesh>
    </group>
  )
}

/* ── Arbre low-poly ── */
function LowPolyTree({ position }: { position: [number, number, number] }) {
  const trunkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#451A03", roughness: 0.9 }), [])
  const leavesMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#064E3B", roughness: 0.8 }), [])

  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} material={trunkMaterial} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.3, 5]} />
      </mesh>
      <mesh position={[0, 0.45, 0]} material={leavesMaterial} castShadow>
        <coneGeometry args={[0.2, 0.4, 5]} />
      </mesh>
    </group>
  )
}

/* ── Pin 3D ── */
function TechPin3D({
  position,
  label,
  color,
}: {
  position: [number, number, number]
  label: string
  color: string
}) {
  const pinRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (pinRef.current) {
      pinRef.current.position.y = Math.sin(t * 2) * 0.05 + 0.5
      pinRef.current.rotation.y = t * 0.4
    }
    if (ringRef.current) {
      const s = (t * 1.2) % 2.2
      ringRef.current.scale.set(s, s, 1)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - s / 2.2) * 0.6
    }
  })

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.05, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      <group ref={pinRef}>
        <mesh rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.12, 0.35, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      <Html distanceFactor={6} position={[0, 1.0, 0]} center>
        <div
          style={{
            background: "#0F172A",
            border: `1px solid ${color}`,
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            boxShadow: `0 4px 12px ${color}40`,
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN — Compact Zoomed City
   ══════════════════════════════════════════════════════════ */
export default function CityMap3D() {
  const dashedLines = useMemo(() => {
    const lines: number[] = []
    for (let i = -8; i <= 8; i += 1.6) {
      if (Math.abs(i) > 0.6) lines.push(i)
    }
    return lines
  }, [])

  return (
    <div
      style={{
        width: "100%",
        height: "650px",
        backgroundColor: "#030712",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <Canvas camera={{ position: [10, 12, 10], fov: 26 }} shadows>
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[10, 15, -5]}
          intensity={1.8}
          color="#38BDF8"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 4, 0]} intensity={3.0} color="#1D4ED8" distance={18} />

        <Environment preset="city" />

        {/* Sol compact 14×14 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial color="#090D16" roughness={0.8} />
        </mesh>

        <gridHelper args={[14, 14, "#1E293B", "#060B13"]} position={[0, -0.01, 0]} />

        {/* Routes compactes */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
          <planeGeometry args={[14, 1.6]} />
          <meshStandardMaterial color="#161F30" roughness={0.3} />
        </mesh>
        {dashedLines.map((pos, i) => (
          <mesh key={`h${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[pos, 0.012, 0]}>
            <planeGeometry args={[0.7, 0.04]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.8} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 1.5708]} position={[0, 0.01, 0]} receiveShadow>
          <planeGeometry args={[14, 1.6]} />
          <meshStandardMaterial color="#161F30" roughness={0.3} />
        </mesh>
        {dashedLines.map((pos, i) => (
          <mesh key={`v${i}`} rotation={[-Math.PI / 2, 0, 1.5708]} position={[0, 0.012, pos]}>
            <planeGeometry args={[0.7, 0.04]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.8} />
          </mesh>
        ))}

        {/* === Immeubles === */}
        <TowerWithWindows position={[-3.5, 2.2, -3]} width={1.4} height={4.4} depth={1.4} rows={10} cols={4} />
        <TowerWithWindows position={[3.5, 2.5, 3]} width={1.5} height={5.0} depth={1.5} rows={12} cols={4} />
        <TowerWithWindows position={[-3, 1.4, 2.5]} width={1.3} height={2.8} depth={1.3} rows={6} cols={3} />
        <TowerWithWindows position={[3, 1.2, -2.5]} width={1.2} height={2.4} depth={1.2} rows={5} cols={3} />
        <TowerWithWindows position={[-5.0, 2.0, -0.2]} width={1.2} height={4.0} depth={1.2} rows={9} cols={3} />
        <TowerWithWindows position={[5.5, 1.6, 3.5]} width={1.3} height={3.2} depth={1.3} rows={7} cols={3} />
        <TowerWithWindows position={[3.5, 1.5, -5.5]} width={1.4} height={3.0} depth={1.1} rows={6} cols={4} />
        <TowerWithWindows position={[-5.5, 1.3, 1.5]} width={1.1} height={2.6} depth={1.1} rows={6} cols={3} />

        {/* === Pavillons === */}
        <ModernArchitecturalHouse position={[1.6, 0, -3.2]} rotationY={Math.PI} />
        <ModernArchitecturalHouse position={[-1.6, 0, 4.2]} rotationY={0} />
        <ModernArchitecturalHouse position={[1.8, 0, 5.0]} rotationY={Math.PI / 2} />
        <ModernArchitecturalHouse position={[-3.8, 0, 5.0]} rotationY={-Math.PI / 2} />

        {/* === Ateliers === */}
        <ObliqueWorkshopBuilding position={[5.5, 0, -3.5]} rotationY={-Math.PI / 2} />
        <ObliqueWorkshopBuilding position={[-5.5, 0, -2.0]} rotationY={Math.PI / 2} />
        <ObliqueWorkshopBuilding position={[5.5, 0, 1.0]} rotationY={0} />
        <ObliqueWorkshopBuilding position={[-1.5, 0, -5.0]} rotationY={Math.PI} />

        {/* === Arbres === */}
        <LowPolyTree position={[1.5, 0, -1.5]} />
        <LowPolyTree position={[-1.5, 0, -1.8]} />
        <LowPolyTree position={[-1.6, 0, 2.2]} />
        <LowPolyTree position={[2.2, 0, 2.0]} />

        {/* === Pins — techniciens dispersés dans la ville === */}
        <TechPin3D position={[0.5, 0, 0]} label="⚡ Demande : Soudeur" color="#FFFFFF" />
        <TechPin3D position={[-4.2, 0, -3.8]} label="Plombier" color="#10B981" />
        <TechPin3D position={[4.8, 0, 3.0]} label="Électricien" color="#10B981" />
        <TechPin3D position={[-5.2, 0, 2.5]} label="Peintre" color="#10B981" />
        <TechPin3D position={[3.0, 0, -4.8]} label="Carreleur" color="#10B981" />
        <TechPin3D position={[5.8, 0, -1.5]} label="Couvreur" color="#F59E0B" />
        <TechPin3D position={[-2.5, 0, 4.8]} label="Menuisier" color="#F59E0B" />

        <OrbitControls enableZoom={false} maxPolarAngle={Math.PI / 2.3} minPolarAngle={Math.PI / 4} />
      </Canvas>
    </div>
  )
}
