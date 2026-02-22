import { Suspense, useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Float, MeshDistortMaterial, Text, Html, Environment } from '@react-three/drei'
import * as THREE from 'three'

// Contract ABI (minimal for our needs)
const CONTRACT_ADDRESS = '0x374531294780aB871568Ebc8a3606c80D62cdc5e'
const CONTRACT_ABI = [
  'function createProfile(uint8 _element) external',
  'function claimDailyFortune() external',
  'function initiateMatch(address opponent) external',
  'function profiles(address) view returns (uint8 element, uint256 luckyNumber, uint256 xp, uint256 level, uint256 energy, uint256 winStreak, uint256 lastFortuneTime, bool exists)',
  'function matchResults(address, address) view returns (address winner, uint256 timestamp)',
  'event ProfileCreated(address indexed user, uint8 element, uint256 luckyNumber)',
  'event DailyFortuneClaimed(address indexed user, uint256 fortune, uint256 newXP)',
  'event MatchCompleted(address indexed player1, address indexed player2, address winner, uint256 xpGained)',
]

type ElementType = 'Fire' | 'Water' | 'Air' | 'Earth'
type GameView = 'connect' | 'create' | 'dashboard' | 'match' | 'battle'

interface Profile {
  element: ElementType
  luckyNumber: number
  xp: number
  level: number
  energy: number
  winStreak: number
  lastFortuneTime: number
  exists: boolean
}

interface MatchResult {
  winner: string
  timestamp: number
  player1Element: ElementType
  player2Element: ElementType
}

const ELEMENTS: ElementType[] = ['Fire', 'Water', 'Air', 'Earth']
const ELEMENT_COLORS: Record<ElementType, string> = {
  Fire: '#FF6B35',
  Water: '#00D4FF',
  Air: '#E8E8E8',
  Earth: '#4ADE80',
}

const ELEMENT_EMOJIS: Record<ElementType, string> = {
  Fire: '🔥',
  Water: '💧',
  Air: '💨',
  Earth: '🌍',
}

// 3D Components
function CosmicOrb({ element, position, scale = 1 }: { element: ElementType; position: [number, number, number]; scale?: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const color = ELEMENT_COLORS[element]

  useFrame((state) => {
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          distort={0.4}
          speed={2}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
      <pointLight position={position} color={color} intensity={2} distance={8} />
    </Float>
  )
}

function ElementRing({ element, radius = 3 }: { element: ElementType; radius?: number }) {
  const ringRef = useRef<THREE.Group>(null!)
  const color = ELEMENT_COLORS[element]
  const particleCount = 60

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        scale: 0.03 + Math.random() * 0.05,
        speed: 0.5 + Math.random() * 0.5,
      }
    })
  }, [radius])

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = state.clock.elapsedTime * 0.2
    }
  })

  return (
    <group ref={ringRef}>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position} scale={particle.scale}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function ConstellationLines() {
  const linesRef = useRef<THREE.Group>(null!)

  const constellations = useMemo(() => {
    const points: THREE.Vector3[][] = []
    for (let i = 0; i < 8; i++) {
      const constellation: THREE.Vector3[] = []
      const baseX = (Math.random() - 0.5) * 30
      const baseY = (Math.random() - 0.5) * 20
      const baseZ = -15 - Math.random() * 10

      for (let j = 0; j < 4 + Math.floor(Math.random() * 3); j++) {
        constellation.push(new THREE.Vector3(
          baseX + (Math.random() - 0.5) * 8,
          baseY + (Math.random() - 0.5) * 8,
          baseZ
        ))
      }
      points.push(constellation)
    }
    return points
  }, [])

  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.1
    }
  })

  return (
    <group ref={linesRef}>
      {constellations.map((constellation, i) => (
        <group key={i}>
          {constellation.map((point, j) => (
            <mesh key={j} position={point}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
            </mesh>
          ))}
          {constellation.slice(0, -1).map((point, j) => {
            const nextPoint = constellation[j + 1]
            const direction = new THREE.Vector3().subVectors(nextPoint, point)
            const center = new THREE.Vector3().addVectors(point, nextPoint).multiplyScalar(0.5)
            return (
              <mesh key={`line-${j}`} position={center}>
                <cylinderGeometry args={[0.01, 0.01, direction.length(), 8]} />
                <meshBasicMaterial color="#4a5568" transparent opacity={0.3} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function BattleArena({ element1, element2, winner }: { element1: ElementType; element2: ElementType; winner?: string }) {
  const arenaRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (arenaRef.current) {
      arenaRef.current.rotation.y = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <group ref={arenaRef}>
      <CosmicOrb element={element1} position={[-2.5, 0, 0]} scale={1.2} />
      <CosmicOrb element={element2} position={[2.5, 0, 0]} scale={1.2} />
      <ElementRing element={element1} radius={1.8} />
      <group position={[5, 0, 0]} rotation={[0, 0, 0]}>
        <ElementRing element={element2} radius={1.8} />
      </group>

      {/* Energy clash effect */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.5, 0.1, 16, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function CosmicScene({ userElement, view, matchElement }: { userElement?: ElementType; view: GameView; matchElement?: ElementType }) {
  return (
    <>
      <color attach="background" args={['#0a0a1a']} />
      <fog attach="fog" args={['#0a0a1a', 10, 50]} />

      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={0.5} color="#9370db" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4169e1" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ConstellationLines />

      {view === 'battle' && matchElement && userElement ? (
        <BattleArena element1={userElement} element2={matchElement} />
      ) : userElement ? (
        <>
          <CosmicOrb element={userElement} position={[0, 0, 0]} scale={1.5} />
          <ElementRing element={userElement} radius={3} />
        </>
      ) : (
        <Float speed={1} rotationIntensity={0.3}>
          <mesh position={[0, 0, 0]}>
            <icosahedronGeometry args={[1.5, 2]} />
            <meshStandardMaterial
              color="#9370db"
              emissive="#4a0080"
              emissiveIntensity={0.3}
              wireframe
            />
          </mesh>
        </Float>
      )}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 1.5}
        minPolarAngle={Math.PI / 3}
      />
      <Environment preset="night" />
    </>
  )
}

// UI Components
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl ${className}`}>
      {children}
    </div>
  )
}

function ElementButton({ element, selected, onClick }: { element: ElementType; selected: boolean; onClick: () => void }) {
  const baseClasses = 'w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3'
  const selectedClasses = selected
    ? 'ring-2 ring-white/50 shadow-lg scale-105'
    : 'hover:scale-102 hover:bg-white/10'

  const bgStyle = {
    background: selected
      ? `linear-gradient(135deg, ${ELEMENT_COLORS[element]}40, ${ELEMENT_COLORS[element]}20)`
      : 'rgba(255,255,255,0.05)',
    borderColor: selected ? ELEMENT_COLORS[element] : 'rgba(255,255,255,0.1)',
    borderWidth: '1px',
    borderStyle: 'solid',
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${selectedClasses}`}
      style={bgStyle}
    >
      <span className="text-2xl">{ELEMENT_EMOJIS[element]}</span>
      <span style={{ color: ELEMENT_COLORS[element] }}>{element}</span>
    </button>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: color || '#fff' }}>{value}</div>
    </div>
  )
}

function ActionButton({ onClick, disabled, children, variant = 'primary', className = '' }: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
    danger: 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        hover:scale-[1.02] active:scale-[0.98] ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// Mock wallet and contract functions (replace with real web3 in production)
function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts'
        })
        const chain = await (window as any).ethereum.request({
          method: 'eth_chainId'
        })
        setAddress(accounts[0])
        setChainId(parseInt(chain, 16))

        // Switch to Base if not on Base
        if (parseInt(chain, 16) !== 8453) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x2105' }],
            })
            setChainId(8453)
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base',
                  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    }
    setIsConnecting(false)
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    setChainId(null)
  }, [])

  return { address, chainId, isConnecting, connect, disconnect }
}

function useContract(address: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [txPending, setTxPending] = useState(false)
  const [lastMatchResult, setLastMatchResult] = useState<MatchResult | null>(null)

  // Mock profile data for demo - in production, this would read from the contract
  const fetchProfile = useCallback(async () => {
    if (!address) return
    setIsLoading(true)

    // Simulate fetching profile - replace with actual contract call
    await new Promise(r => setTimeout(r, 1000))

    // Check localStorage for demo persistence
    const stored = localStorage.getItem(`astro_profile_${address}`)
    if (stored) {
      setProfile(JSON.parse(stored))
    } else {
      setProfile(null)
    }
    setIsLoading(false)
  }, [address])

  const createProfile = useCallback(async (element: ElementType) => {
    if (!address) return
    setTxPending(true)

    try {
      if ((window as any).ethereum) {
        // Encode function call
        const elementIndex = ELEMENTS.indexOf(element)
        const data = `0x5c28a3c2${elementIndex.toString(16).padStart(64, '0')}`

        await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: CONTRACT_ADDRESS,
            data,
            gas: '0x30000',
          }],
        })
      }

      // Demo: create local profile
      const newProfile: Profile = {
        element,
        luckyNumber: Math.floor(Math.random() * 100) + 1,
        xp: 0,
        level: 1,
        energy: 100,
        winStreak: 0,
        lastFortuneTime: 0,
        exists: true,
      }
      setProfile(newProfile)
      localStorage.setItem(`astro_profile_${address}`, JSON.stringify(newProfile))
    } catch (error) {
      console.error('Failed to create profile:', error)
    }
    setTxPending(false)
  }, [address])

  const claimDailyFortune = useCallback(async () => {
    if (!address || !profile) return
    setTxPending(true)

    try {
      if ((window as any).ethereum) {
        const data = '0x7c2f6e7d'

        await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: CONTRACT_ADDRESS,
            data,
            gas: '0x30000',
          }],
        })
      }

      // Demo: update profile
      const fortune = Math.floor(Math.random() * 50) + 10
      const updatedProfile = {
        ...profile,
        xp: profile.xp + fortune,
        level: Math.floor((profile.xp + fortune) / 100) + 1,
        lastFortuneTime: Date.now(),
      }
      setProfile(updatedProfile)
      localStorage.setItem(`astro_profile_${address}`, JSON.stringify(updatedProfile))
    } catch (error) {
      console.error('Failed to claim fortune:', error)
    }
    setTxPending(false)
  }, [address, profile])

  const initiateMatch = useCallback(async (opponent: string) => {
    if (!address || !profile) return
    setTxPending(true)

    try {
      if ((window as any).ethereum) {
        const paddedOpponent = opponent.slice(2).padStart(64, '0')
        const data = `0x1a2b3c4d${paddedOpponent}`

        await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to: CONTRACT_ADDRESS,
            data,
            gas: '0x50000',
          }],
        })
      }

      // Demo: simulate match result
      const opponentElement = ELEMENTS[Math.floor(Math.random() * 4)]
      const userWins = Math.random() > 0.5
      const xpGained = userWins ? 25 : 5

      const result: MatchResult = {
        winner: userWins ? address : opponent,
        timestamp: Date.now(),
        player1Element: profile.element,
        player2Element: opponentElement,
      }
      setLastMatchResult(result)

      const updatedProfile = {
        ...profile,
        xp: profile.xp + xpGained,
        level: Math.floor((profile.xp + xpGained) / 100) + 1,
        winStreak: userWins ? profile.winStreak + 1 : 0,
        energy: Math.max(0, profile.energy - 10),
      }
      setProfile(updatedProfile)
      localStorage.setItem(`astro_profile_${address}`, JSON.stringify(updatedProfile))
    } catch (error) {
      console.error('Failed to initiate match:', error)
    }
    setTxPending(false)
  }, [address, profile])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const canClaimFortune = profile ? Date.now() - profile.lastFortuneTime > 24 * 60 * 60 * 1000 : false
  const timeUntilFortune = profile ? Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - profile.lastFortuneTime)) : 0

  return {
    profile,
    isLoading,
    txPending,
    lastMatchResult,
    createProfile,
    claimDailyFortune,
    initiateMatch,
    canClaimFortune,
    timeUntilFortune,
  }
}

function formatTime(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  return `${hours}h ${minutes}m`
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Main App
export default function App() {
  const { address, chainId, isConnecting, connect, disconnect } = useWallet()
  const {
    profile, isLoading, txPending, lastMatchResult,
    createProfile, claimDailyFortune, initiateMatch,
    canClaimFortune, timeUntilFortune
  } = useContract(address)

  const [view, setView] = useState<GameView>('connect')
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null)
  const [opponentAddress, setOpponentAddress] = useState('')
  const [matchElement, setMatchElement] = useState<ElementType | undefined>()

  // Determine view based on state
  useEffect(() => {
    if (!address) {
      setView('connect')
    } else if (isLoading) {
      setView('connect')
    } else if (!profile?.exists) {
      setView('create')
    } else if (lastMatchResult && view === 'match') {
      setMatchElement(lastMatchResult.player2Element)
      setView('battle')
    } else if (view === 'connect' || view === 'create') {
      setView('dashboard')
    }
  }, [address, profile, isLoading, lastMatchResult, view])

  const handleCreateProfile = async () => {
    if (selectedElement) {
      await createProfile(selectedElement)
    }
  }

  const handleMatch = async () => {
    if (opponentAddress && opponentAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      await initiateMatch(opponentAddress)
    }
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ fontFamily: "'Cinzel', serif" }}>
      {/* 3D Background */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
          <Suspense fallback={null}>
            <CosmicScene
              userElement={profile?.element}
              view={view}
              matchElement={matchElement}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <span className="text-xl md:text-2xl">✨</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-violet-300 to-purple-200 bg-clip-text text-transparent">
                Cosmic Clash
              </h1>
              <p className="text-[10px] md:text-xs text-gray-400 tracking-widest uppercase">Astrology on Base</p>
            </div>
          </div>

          {address && (
            <div className="flex items-center gap-2 md:gap-4">
              {chainId === 8453 && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-xs text-blue-300">Base</span>
                </div>
              )}
              <button
                onClick={disconnect}
                className="px-3 md:px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs md:text-sm hover:bg-white/20 transition-all"
              >
                {shortenAddress(address)}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="absolute inset-0 z-10 flex items-center justify-center p-4 pt-20 pb-16">
        {/* Connect View */}
        {view === 'connect' && (
          <GlassCard className="w-full max-w-md p-6 md:p-8 text-center animate-fade-in">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-700/30 flex items-center justify-center border border-violet-500/30">
                <span className="text-4xl">🌟</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Enter the Cosmos</h2>
              <p className="text-gray-400" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                Connect your wallet to begin your celestial journey
              </p>
            </div>

            <ActionButton onClick={connect} disabled={isConnecting}>
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⟳</span> Connecting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>🔮</span> Connect Wallet
                </span>
              )}
            </ActionButton>

            <p className="mt-4 text-xs text-gray-500" style={{ fontFamily: "'Quicksand', sans-serif" }}>
              Make sure you're on Base Network
            </p>
          </GlassCard>
        )}

        {/* Create Profile View */}
        {view === 'create' && (
          <GlassCard className="w-full max-w-md p-6 md:p-8 animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Choose Your Element</h2>
              <p className="text-gray-400" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                Your element determines your cosmic destiny
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {ELEMENTS.map(element => (
                <ElementButton
                  key={element}
                  element={element}
                  selected={selectedElement === element}
                  onClick={() => setSelectedElement(element)}
                />
              ))}
            </div>

            <ActionButton
              onClick={handleCreateProfile}
              disabled={!selectedElement || txPending}
            >
              {txPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⟳</span> Creating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>✨</span> Create Profile
                </span>
              )}
            </ActionButton>
          </GlassCard>
        )}

        {/* Dashboard View */}
        {view === 'dashboard' && profile && (
          <div className="w-full max-w-lg space-y-4 animate-fade-in">
            {/* Profile Card */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{
                    background: `linear-gradient(135deg, ${ELEMENT_COLORS[profile.element]}40, ${ELEMENT_COLORS[profile.element]}20)`,
                    border: `2px solid ${ELEMENT_COLORS[profile.element]}50`,
                  }}
                >
                  {ELEMENT_EMOJIS[profile.element]}
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: ELEMENT_COLORS[profile.element] }}>
                    {profile.element} Guardian
                  </h2>
                  <p className="text-gray-400 text-sm" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                    Level {profile.level} • Lucky #{profile.luckyNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="XP" value={profile.xp} icon="⚡" color="#a78bfa" />
                <StatCard label="Level" value={profile.level} icon="🏆" color="#fbbf24" />
                <StatCard label="Energy" value={profile.energy} icon="💫" color="#34d399" />
                <StatCard label="Streak" value={profile.winStreak} icon="🔥" color="#f87171" />
              </div>
            </GlassCard>

            {/* Daily Fortune */}
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🌙</span> Daily Fortune
                </h3>
                {!canClaimFortune && (
                  <span className="text-xs text-gray-400 px-3 py-1 rounded-full bg-white/5">
                    {formatTime(timeUntilFortune)}
                  </span>
                )}
              </div>

              <ActionButton
                onClick={claimDailyFortune}
                disabled={!canClaimFortune || txPending}
                variant="secondary"
              >
                {txPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> Claiming...
                  </span>
                ) : canClaimFortune ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>🎴</span> Claim Fortune
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>⏳</span> Come Back Later
                  </span>
                )}
              </ActionButton>
            </GlassCard>

            {/* PvP Match */}
            <GlassCard className="p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <span>⚔️</span> Element Clash
              </h3>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Opponent's address (0x...)"
                  value={opponentAddress}
                  onChange={(e) => setOpponentAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition-all"
                  style={{ fontFamily: "'Quicksand', sans-serif" }}
                />
              </div>

              <ActionButton
                onClick={handleMatch}
                disabled={!opponentAddress.match(/^0x[a-fA-F0-9]{40}$/) || txPending || profile.energy < 10}
                variant="danger"
              >
                {txPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> Battling...
                  </span>
                ) : profile.energy < 10 ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>💫</span> Low Energy
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>⚔️</span> Challenge (-10 Energy)
                  </span>
                )}
              </ActionButton>
            </GlassCard>
          </div>
        )}

        {/* Battle Result View */}
        {view === 'battle' && lastMatchResult && profile && (
          <GlassCard className="w-full max-w-md p-6 md:p-8 text-center animate-fade-in">
            <div className="mb-6">
              <div className="text-6xl mb-4 animate-bounce">
                {lastMatchResult.winner === address ? '🏆' : '💔'}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2"
                style={{ color: lastMatchResult.winner === address ? '#4ade80' : '#f87171' }}>
                {lastMatchResult.winner === address ? 'Victory!' : 'Defeat'}
              </h2>
              <p className="text-gray-400" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                {ELEMENT_EMOJIS[lastMatchResult.player1Element]} {lastMatchResult.player1Element} vs {lastMatchResult.player2Element} {ELEMENT_EMOJIS[lastMatchResult.player2Element]}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard
                label="XP Earned"
                value={lastMatchResult.winner === address ? '+25' : '+5'}
                icon="⚡"
                color="#a78bfa"
              />
              <StatCard
                label="Win Streak"
                value={profile.winStreak}
                icon="🔥"
                color="#f87171"
              />
            </div>

            <ActionButton onClick={() => {
              setView('dashboard')
              setOpponentAddress('')
            }}>
              <span className="flex items-center justify-center gap-2">
                <span>🌟</span> Continue
              </span>
            </ActionButton>
          </GlassCard>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 p-4 text-center">
        <p className="text-[10px] md:text-xs text-gray-600" style={{ fontFamily: "'Quicksand', sans-serif" }}>
          Requested by @jianke2 · Built by @clonkbot
        </p>
        <p className="text-[8px] md:text-[10px] text-gray-700 mt-1" style={{ fontFamily: "'Quicksand', sans-serif" }}>
          Contract: {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
        </p>
      </footer>

      {/* Global Styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}
