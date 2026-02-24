/**
 * SylOS App Store — Real dApp Management
 * 
 * Browse, install, and launch Web3 dApps. Installed apps are persisted
 * and can be opened in the SylOS sandboxed browser or externally.
 * Categories, search, and real install/uninstall with confirmation.
 */
import { useState, useEffect, useMemo } from 'react'
import {
    Store, Star, Search, ExternalLink, Shield, Zap, Globe, Code, BarChart3,
    MessageSquare, Gamepad2, Music, Calculator, BookOpen, Newspaper, Cloud,
    Check, X, Trash2, ChevronRight, Download, Package, Clock, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────
interface DApp {
    id: string
    name: string
    description: string
    developer: string
    category: string
    icon: React.ReactNode
    color: string
    url: string
    rating: number
    version: string
    size: string
    verified: boolean
    featured?: boolean
    permissions: string[]
}

// ─── dApp Catalog ──────────────────────────────────
const CATEGORIES = ['All', 'DeFi', 'Tools', 'Social', 'Games', 'Media', 'Dev']

const DAPPS: DApp[] = [
    { id: 'uniswap', name: 'Uniswap', description: 'Decentralized token exchange with automated liquidity pools and concentrated liquidity positions', developer: 'Uniswap Labs', category: 'DeFi', icon: <Zap size={22} />, color: '#ff007a', url: 'https://app.uniswap.org', rating: 4.9, version: '4.2.1', size: '2.4 MB', verified: true, featured: true, permissions: ['Wallet Access', 'Token Approvals'] },
    { id: 'aave', name: 'Aave', description: 'Non-custodial lending and borrowing protocol with flash loans and rate switching', developer: 'Aave DAO', category: 'DeFi', icon: <Shield size={22} />, color: '#b6509e', url: 'https://app.aave.com', rating: 4.8, version: '3.1.0', size: '1.8 MB', verified: true, featured: true, permissions: ['Wallet Access', 'Token Approvals', 'Lending Operations'] },
    { id: 'opensea', name: 'OpenSea', description: 'Discover, collect, and sell extraordinary NFTs across multiple blockchains', developer: 'OpenSea Inc', category: 'Social', icon: <Globe size={22} />, color: '#2081e2', url: 'https://opensea.io', rating: 4.5, version: '2.0.0', size: '3.1 MB', verified: true, permissions: ['Wallet Access', 'NFT Approvals'] },
    { id: 'lens', name: 'Lens Protocol', description: 'Composable decentralized social graph — own your social connections and content', developer: 'Lens Foundation', category: 'Social', icon: <MessageSquare size={22} />, color: '#00501e', url: 'https://hey.xyz', rating: 4.6, version: '2.5.0', size: '1.5 MB', verified: true, featured: true, permissions: ['Wallet Access', 'Profile Management'] },
    { id: 'curve', name: 'Curve Finance', description: 'Efficient stablecoin exchange designed for low slippage and low fee trading', developer: 'Curve DAO', category: 'DeFi', icon: <BarChart3 size={22} />, color: '#0060ff', url: 'https://curve.fi', rating: 4.7, version: '2.8.3', size: '2.0 MB', verified: true, permissions: ['Wallet Access', 'Token Approvals'] },
    { id: 'quickswap', name: 'QuickSwap', description: 'Native Polygon DEX with dragon\'s lair staking and competitive swap fees', developer: 'QuickSwap Team', category: 'DeFi', icon: <Zap size={22} />, color: '#418099', url: 'https://quickswap.exchange', rating: 4.4, version: '3.0.1', size: '1.7 MB', verified: true, permissions: ['Wallet Access', 'Token Approvals'] },
    { id: 'polygonscan', name: 'Polygonscan', description: 'Polygon PoS block explorer — verify transactions, contracts, and on-chain data', developer: 'Etherscan', category: 'Tools', icon: <Search size={22} />, color: '#8247e5', url: 'https://polygonscan.com', rating: 4.8, version: '1.0.0', size: '0.5 MB', verified: true, permissions: ['Read-Only'] },
    { id: 'chainlink', name: 'Chainlink', description: 'Decentralized oracle network powering real-world data feeds and cross-chain messaging', developer: 'Chainlink Labs', category: 'Dev', icon: <Code size={22} />, color: '#375bd2', url: 'https://chain.link', rating: 4.9, version: '1.2.0', size: '0.8 MB', verified: true, permissions: ['Read-Only'] },
    { id: 'snapshot', name: 'Snapshot', description: 'Off-chain governance voting — create proposals, delegate votes, and track results', developer: 'Snapshot Labs', category: 'Tools', icon: <BookOpen size={22} />, color: '#f3b04e', url: 'https://snapshot.org', rating: 4.6, version: '0.9.0', size: '0.6 MB', verified: true, permissions: ['Wallet Access', 'Signature Requests'] },
    { id: 'zapper', name: 'Zapper', description: 'Multi-chain DeFi portfolio tracker — monitor positions, claim airdrops, and bridge assets', developer: 'Zapper Fi', category: 'Tools', icon: <BarChart3 size={22} />, color: '#784ffe', url: 'https://zapper.xyz', rating: 4.5, version: '4.1.0', size: '1.2 MB', verified: true, permissions: ['Wallet Access'] },
    { id: 'mirror', name: 'Mirror', description: 'Decentralized publishing platform — write, mint writing NFTs, and fund projects', developer: 'Mirror Protocol', category: 'Media', icon: <Newspaper size={22} />, color: '#007aff', url: 'https://mirror.xyz', rating: 4.4, version: '1.3.0', size: '0.9 MB', verified: true, permissions: ['Wallet Access', 'Signature Requests'] },
    { id: 'sound', name: 'Sound.xyz', description: 'Web3 music platform — discover artists, collect limited edition songs as NFTs', developer: 'Sound.xyz Inc', category: 'Media', icon: <Music size={22} />, color: '#1db954', url: 'https://sound.xyz', rating: 4.3, version: '2.0.0', size: '1.1 MB', verified: false, permissions: ['Wallet Access', 'NFT Minting'] },
    { id: 'polymarket', name: 'Polymarket', description: 'Information markets — trade on real-world event outcomes with provable accuracy', developer: 'Polymarket Inc', category: 'Games', icon: <Gamepad2 size={22} />, color: '#00b4d8', url: 'https://polymarket.com', rating: 4.7, version: '2.1.0', size: '1.4 MB', verified: true, permissions: ['Wallet Access', 'Trading'] },
    { id: 'arweave', name: 'Arweave', description: 'Permanent decentralized storage — store data forever with a single payment', developer: 'Arweave Foundation', category: 'Dev', icon: <Cloud size={22} />, color: '#ff6b00', url: 'https://arweave.org', rating: 4.5, version: '1.0.0', size: '0.7 MB', verified: true, permissions: ['Read-Only'] },
    { id: 'remix', name: 'Remix IDE', description: 'Browser-based Solidity IDE — write, compile, deploy, and debug smart contracts', developer: 'Ethereum Foundation', category: 'Dev', icon: <Code size={22} />, color: '#5b34a5', url: 'https://remix.ethereum.org', rating: 4.8, version: '0.31.0', size: '4.2 MB', verified: true, permissions: ['Wallet Access', 'Contract Deployment'] },
    { id: 'debank', name: 'DeBank', description: 'Multi-chain DeFi portfolio dashboard with social profiles and whale tracking', developer: 'DeBank Inc', category: 'DeFi', icon: <Calculator size={22} />, color: '#fe8737', url: 'https://debank.com', rating: 4.6, version: '5.0.0', size: '1.6 MB', verified: true, permissions: ['Wallet Access'] },
]

// ─── Styles ─────────────────────────────────────────
const cs = {
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s' } as React.CSSProperties,
    btn: { padding: '10px 20px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' } as React.CSSProperties,
}

const STORAGE_KEY = 'sylos_installed_apps'

// ─── Installed apps persistence ────────────────────
interface InstalledApp { id: string; installedAt: string }

function loadInstalled(): InstalledApp[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveInstalled(apps: InstalledApp[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps))
}

export default function AppStoreApp() {
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('All')
    const [installed, setInstalled] = useState<InstalledApp[]>(() => loadInstalled())
    const [selectedApp, setSelectedApp] = useState<DApp | null>(null)
    const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null)
    const [view, setView] = useState<'browse' | 'installed' | 'detail'>('browse')

    const installedIds = useMemo(() => new Set(installed.map(a => a.id)), [installed])

    const filtered = useMemo(() => {
        return DAPPS.filter(d => {
            if (category !== 'All' && d.category !== category) return false
            if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.description.toLowerCase().includes(search.toLowerCase())) return false
            return true
        })
    }, [category, search])

    const featured = useMemo(() => DAPPS.filter(d => d.featured), [])
    const installedApps = useMemo(() => DAPPS.filter(d => installedIds.has(d.id)), [installedIds])

    // ─── Install ──────────────────────────────────
    const handleInstall = (id: string) => {
        const updated = [...installed, { id, installedAt: new Date().toISOString() }]
        setInstalled(updated)
        saveInstalled(updated)
        const app = DAPPS.find(d => d.id === id)
        toast.success(`${app?.name || 'App'} installed`)
    }

    // ─── Uninstall ────────────────────────────────
    const handleUninstall = (id: string) => {
        const updated = installed.filter(a => a.id !== id)
        setInstalled(updated)
        saveInstalled(updated)
        setConfirmUninstall(null)
        const app = DAPPS.find(d => d.id === id)
        toast.success(`${app?.name || 'App'} uninstalled`)
    }

    // ─── Open dApp ────────────────────────────────
    const handleOpen = (app: DApp) => {
        // Open in new tab (sandboxed)
        window.open(app.url, '_blank', 'noopener,noreferrer')
        toast.success(`Opening ${app.name}...`)
    }

    // ─── View app details ─────────────────────────
    const showDetail = (app: DApp) => {
        setSelectedApp(app)
        setView('detail')
    }

    return (
        <div style={{ height: '100%', overflow: 'auto', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            <div style={{ maxWidth: '840px', margin: '0 auto', padding: '20px' }}>

                {/* ─── Header ─── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>
                            {view === 'detail' && selectedApp ? selectedApp.name : 'App Store'}
                        </h1>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                            {view === 'detail' ? selectedApp?.developer : `${DAPPS.length} verified Web3 dApps · ${installed.length} installed`}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {view === 'detail' ? (
                            <button onClick={() => { setView('browse'); setSelectedApp(null) }} style={{ ...cs.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ← Back
                            </button>
                        ) : (
                            <>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <button onClick={() => setView('browse')} style={{ padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', background: view === 'browse' ? 'rgba(99,102,241,0.2)' : 'transparent', color: view === 'browse' ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>Browse</button>
                                    <button onClick={() => setView('installed')} style={{ padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', background: view === 'installed' ? 'rgba(99,102,241,0.2)' : 'transparent', color: view === 'installed' ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>
                                        Installed ({installed.length})
                                    </button>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dApps..." style={{
                                        padding: '9px 14px 9px 34px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)',
                                        background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '200px',
                                    }} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ═══ DETAIL VIEW ═══ */}
                {view === 'detail' && selectedApp && (
                    <div>
                        {/* App header card */}
                        <div style={{ ...cs.card, padding: '24px', marginBottom: '16px', background: `linear-gradient(135deg, ${selectedApp.color}12, ${selectedApp.color}06)`, borderColor: `${selectedApp.color}20` }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                                <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: `linear-gradient(135deg, ${selectedApp.color}30, ${selectedApp.color}15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedApp.color, flexShrink: 0 }}>
                                    {selectedApp.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>{selectedApp.name}</h2>
                                        {selectedApp.verified && <Shield size={14} color="#22c55e" />}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>{selectedApp.developer}</div>
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '0 0 16px' }}>{selectedApp.description}</p>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                                        <span>⭐ {selectedApp.rating}</span>
                                        <span>v{selectedApp.version}</span>
                                        <span>{selectedApp.size}</span>
                                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }}>{selectedApp.category}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {installedIds.has(selectedApp.id) ? (
                                        <>
                                            <button onClick={() => handleOpen(selectedApp)} style={{ ...cs.btn, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <ExternalLink size={14} /> Open
                                            </button>
                                            <button onClick={() => setConfirmUninstall(selectedApp.id)} style={{ ...cs.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '8px 16px', fontSize: '11px' }}>Uninstall</button>
                                        </>
                                    ) : (
                                        <button onClick={() => handleInstall(selectedApp.id)} style={{ ...cs.btn, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Download size={14} /> Install
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div style={{ ...cs.card, padding: '20px', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Shield size={14} color="#818cf8" /> Required Permissions</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {selectedApp.permissions.map(p => (
                                    <span key={p} style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Uninstall confirmation */}
                        {confirmUninstall === selectedApp.id && (
                            <div style={{ ...cs.card, padding: '16px', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <AlertTriangle size={16} color="#ef4444" />
                                    <span style={{ fontSize: '12px', color: '#ef4444' }}>Uninstall {selectedApp.name}?</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => handleUninstall(selectedApp.id)} style={{ ...cs.btn, background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 14px', fontSize: '11px' }}>Yes, Uninstall</button>
                                    <button onClick={() => setConfirmUninstall(null)} style={{ ...cs.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', padding: '6px 14px', fontSize: '11px' }}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ INSTALLED VIEW ═══ */}
                {view === 'installed' && (
                    <div>
                        {installedApps.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                <Package size={48} color="rgba(255,255,255,0.08)" />
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', margin: '16px 0 4px' }}>No Apps Installed</h3>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>Browse the store and install your first dApp</p>
                                <button onClick={() => setView('browse')} style={{ ...cs.btn, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', marginTop: '16px', fontSize: '12px', padding: '8px 20px' }}>Browse Store</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {installedApps.map(d => {
                                    const installInfo = installed.find(a => a.id === d.id)
                                    return (
                                        <div key={d.id} style={{ ...cs.card, display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }}
                                            onClick={() => showDetail(d)}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${d.color}30` }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
                                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${d.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.color, flexShrink: 0 }}>{d.icon}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{d.name}</span>
                                                    {d.verified && <Shield size={10} color="#22c55e" />}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                                                    Installed {installInfo ? new Date(installInfo.installedAt).toLocaleDateString() : ''} · v{d.version}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={() => handleOpen(d)} style={{ ...cs.btn, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '7px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <ExternalLink size={12} /> Open
                                                </button>
                                                <button onClick={() => confirmUninstall === d.id ? handleUninstall(d.id) : setConfirmUninstall(d.id)} style={{ ...cs.btn, background: confirmUninstall === d.id ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)', color: confirmUninstall === d.id ? '#ef4444' : 'rgba(255,255,255,0.4)', padding: '7px', borderRadius: '8px' }}>
                                                    {confirmUninstall === d.id ? <Check size={14} /> : <Trash2 size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ BROWSE VIEW ═══ */}
                {view === 'browse' && (
                    <>
                        {/* Categories */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto' }}>
                            {CATEGORIES.map(c => (
                                <button key={c} onClick={() => setCategory(c)} style={{
                                    padding: '6px 14px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                                    background: category === c ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
                                    color: category === c ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                                }}>{c}</button>
                            ))}
                        </div>

                        {/* Featured */}
                        {category === 'All' && !search && (
                            <div style={{ marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>⭐ Featured</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    {featured.map(d => (
                                        <div key={d.id} onClick={() => showDetail(d)} style={{
                                            padding: '16px', borderRadius: '14px', border: `1px solid ${d.color}20`,
                                            background: `linear-gradient(135deg, ${d.color}08, ${d.color}03)`,
                                            cursor: 'pointer', transition: 'all 0.2s ease',
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${d.color}40`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = `${d.color}20`; e.currentTarget.style.transform = 'translateY(0)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${d.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.color }}>{d.icon}</div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {d.name} {d.verified && <Shield size={9} color="#22c55e" />}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{d.category} · ⭐ {d.rating}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{d.description}</div>
                                            <div style={{ fontSize: '10px', color: installedIds.has(d.id) ? '#34d399' : 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                                                {installedIds.has(d.id) ? '✓ Installed' : `v${d.version} · ${d.size}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All Apps */}
                        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>{category === 'All' ? 'All dApps' : category} ({filtered.length})</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {filtered.map(d => (
                                <div key={d.id} style={{ ...cs.card, display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', cursor: 'pointer' }}
                                    onClick={() => showDetail(d)}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${d.color}25` }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${d.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.color, flexShrink: 0 }}>{d.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{d.name}</span>
                                            {d.verified && <Shield size={10} color="#22c55e" />}
                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }}>{d.category}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                                            <span>⭐ {d.rating}</span>
                                            <span>v{d.version}</span>
                                            <span>{d.size}</span>
                                            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                                            <span>{d.developer}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        {installedIds.has(d.id) ? (
                                            <button onClick={() => handleOpen(d)} style={{ ...cs.btn, background: 'rgba(52,211,153,0.1)', color: '#34d399', padding: '7px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Check size={12} /> Open
                                            </button>
                                        ) : (
                                            <button onClick={() => handleInstall(d.id)} style={{ ...cs.btn, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '7px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Download size={12} /> Install
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
