import { useState, useCallback, useRef, useEffect } from 'react'
import {
    Globe, ArrowLeft, ArrowRight, RotateCw, Home, Star, X, Plus, Search, Shield,
    ExternalLink, Lock, Bookmark
} from 'lucide-react'

interface Tab {
    id: string
    url: string
    title: string
    loading: boolean
}

const BOOKMARKS_KEY = 'sylos_browser_bookmarks'
const HOME_URL = 'https://polygon.technology'

const QUICK_LINKS = [
    { name: 'Polygonscan', url: 'https://polygonscan.com', color: '#8247e5' },
    { name: 'Uniswap', url: 'https://app.uniswap.org', color: '#ff007a' },
    { name: 'Aave', url: 'https://app.aave.com', color: '#b6509e' },
    { name: 'OpenSea', url: 'https://opensea.io', color: '#2081e2' },
    { name: 'Snapshot', url: 'https://snapshot.org', color: '#f3b04e' },
    { name: 'DeBank', url: 'https://debank.com', color: '#fe8737' },
    { name: 'Remix IDE', url: 'https://remix.ethereum.org', color: '#5b34a5' },
    { name: 'Mirror', url: 'https://mirror.xyz', color: '#007aff' },
]

export default function WebBrowserApp() {
    const [tabs, setTabs] = useState<Tab[]>([
        { id: 'tab_1', url: '', title: 'New Tab', loading: false }
    ])
    const [activeTabId, setActiveTabId] = useState('tab_1')
    const [urlInput, setUrlInput] = useState('')
    const [bookmarks, setBookmarks] = useState<{ name: string; url: string }[]>(() => {
        try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]') } catch { return [] }
    })
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

    useEffect(() => {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks))
    }, [bookmarks])

    const navigate = useCallback((url: string) => {
        let finalUrl = url.trim()
        if (!finalUrl) return
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
                finalUrl = 'https://' + finalUrl
            } else {
                finalUrl = `https://www.google.com/search?igu=1&q=${encodeURIComponent(finalUrl)}`
            }
        }
        setTabs(p => p.map(t => t.id === activeTabId ? { ...t, url: finalUrl, title: new URL(finalUrl).hostname, loading: true } : t))
        setUrlInput(finalUrl)
    }, [activeTabId])

    const newTab = useCallback(() => {
        const id = `tab_${Date.now()}`
        setTabs(p => [...p, { id, url: '', title: 'New Tab', loading: false }])
        setActiveTabId(id)
        setUrlInput('')
    }, [])

    const closeTab = useCallback((id: string) => {
        if (tabs.length <= 1) return
        const idx = tabs.findIndex(t => t.id === id)
        setTabs(p => p.filter(t => t.id !== id))
        if (activeTabId === id) {
            const next = tabs[idx - 1] || tabs[idx + 1]
            if (next) { setActiveTabId(next.id); setUrlInput(next.url) }
        }
    }, [tabs, activeTabId])

    const addBookmark = useCallback(() => {
        if (!activeTab.url) return
        const exists = bookmarks.some(b => b.url === activeTab.url)
        if (exists) {
            setBookmarks(p => p.filter(b => b.url !== activeTab.url))
        } else {
            setBookmarks(p => [...p, { name: activeTab.title, url: activeTab.url }])
        }
    }, [activeTab, bookmarks])

    const isBookmarked = bookmarks.some(b => b.url === activeTab.url)

    // New tab page
    const showNewTabPage = !activeTab.url

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 0', background: 'rgba(0,0,0,0.2)' }}>
                {tabs.map(t => (
                    <div key={t.id} onClick={() => { setActiveTabId(t.id); setUrlInput(t.url) }} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                        background: activeTabId === t.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                        maxWidth: '180px', minWidth: '60px',
                    }}>
                        <Globe size={11} color="rgba(255,255,255,0.3)" />
                        <span style={{ fontSize: '11px', color: activeTabId === t.id ? '#fff' : 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500 }}>{t.title}</span>
                        {tabs.length > 1 && (
                            <button onClick={e => { e.stopPropagation(); closeTab(t.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'rgba(255,255,255,0.2)', borderRadius: '4px' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                            ><X size={10} /></button>
                        )}
                    </div>
                ))}
                <button onClick={newTab} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'rgba(255,255,255,0.3)', borderRadius: '6px' }}>
                    <Plus size={14} />
                </button>
            </div>

            {/* URL bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <button onClick={() => navigate(HOME_URL)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(255,255,255,0.3)', borderRadius: '6px' }}><Home size={14} /></button>
                <button onClick={() => iframeRef.current?.contentWindow?.location.reload()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(255,255,255,0.3)', borderRadius: '6px' }}><RotateCw size={14} /></button>

                <form onSubmit={e => { e.preventDefault(); navigate(urlInput) }} style={{ flex: 1, display: 'flex' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        {activeTab.url && <Lock size={11} style={{ position: 'absolute', left: '10px', color: activeTab.url.startsWith('https') ? '#22c55e' : '#f59e0b' }} />}
                        <input
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            placeholder="Search or enter URL..."
                            style={{
                                width: '100%', padding: '7px 12px 7px 28px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
                                outline: 'none', boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.select()}
                        />
                    </div>
                </form>

                <button onClick={addBookmark} title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isBookmarked ? '#f59e0b' : 'rgba(255,255,255,0.3)', borderRadius: '6px' }}>
                    <Star size={14} fill={isBookmarked ? '#f59e0b' : 'none'} />
                </button>
            </div>

            {/* Bookmarks bar */}
            {bookmarks.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', padding: '4px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto' }}>
                    {bookmarks.map((b, i) => (
                        <button key={i} onClick={() => navigate(b.url)} style={{
                            padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'inherit',
                            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                            <Bookmark size={9} /> {b.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, position: 'relative' }}>
                {showNewTabPage ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Globe size={28} color="#818cf8" />
                            <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>SylOS Browser</span>
                        </div>

                        <form onSubmit={e => { e.preventDefault(); navigate(urlInput) }} style={{ width: '100%', maxWidth: '500px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                                <input
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    placeholder="Search the web or enter a URL..."
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '14px 20px 14px 44px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)',
                                        background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        </form>

                        {/* Quick links */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '500px', width: '100%' }}>
                            {QUICK_LINKS.map(l => (
                                <button key={l.name} onClick={() => navigate(l.url)} style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 8px', borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.15s',
                                    fontFamily: 'inherit',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                >
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${l.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Globe size={18} color={l.color} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{l.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Sandbox notice */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                            <Shield size={12} color="#f59e0b" />
                            <span style={{ fontSize: '10px', color: '#f59e0b' }}>All sites run in an isolated SylOS sandbox</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Sandbox banner */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(245,158,11,0.06)', color: '#f59e0b', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                            <Shield size={10} /> Sandboxed — {new URL(activeTab.url).hostname}
                        </div>
                        <iframe
                            ref={iframeRef}
                            src={activeTab.url}
                            onLoad={() => setTabs(p => p.map(t => t.id === activeTabId ? { ...t, loading: false } : t))}
                            style={{ width: '100%', height: 'calc(100% - 24px)', border: 'none', background: '#fff' }}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            title={activeTab.title}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
