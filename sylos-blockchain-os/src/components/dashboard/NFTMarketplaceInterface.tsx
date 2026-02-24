import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Image, ShoppingBag, Plus, Heart, Eye, Filter, Grid, List, Tag, Wallet } from 'lucide-react'

const collections = [
  { name: 'SylOS Genesis', items: 10000, floor: '0.05 POL', volume: '45.2 POL', image: '🎨' },
  { name: 'Polygon Punks', items: 5000, floor: '2.1 POL', volume: '1,200 POL', image: '👾' },
  { name: 'DeFi Wizards', items: 3000, floor: '0.8 POL', volume: '320 POL', image: '🧙' },
]

const nfts = [
  { id: 1, name: 'Genesis Agent #001', collection: 'SylOS Genesis', price: '0.15 POL', emoji: '🤖', likes: 42 },
  { id: 2, name: 'Neural Network #128', collection: 'SylOS Genesis', price: '0.22 POL', emoji: '🧠', likes: 38 },
  { id: 3, name: 'Cyber Punk #456', collection: 'Polygon Punks', price: '3.5 POL', emoji: '👾', likes: 156 },
  { id: 4, name: 'DeFi Wizard #089', collection: 'DeFi Wizards', price: '1.2 POL', emoji: '🧙', likes: 89 },
  { id: 5, name: 'Genesis Agent #042', collection: 'SylOS Genesis', price: '0.08 POL', emoji: '🤖', likes: 27 },
  { id: 6, name: 'Blockchain Cat #777', collection: 'Polygon Punks', price: '5.0 POL', emoji: '🐱', likes: 203 },
]

const cs = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' } as React.CSSProperties,
  btn: { padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  tab: (a: boolean) => ({ padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', background: a ? 'rgba(99,102,241,0.2)' : 'transparent', color: a ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }) as React.CSSProperties,
}

export default function NFTMarketplaceInterface() {
  const { address } = useAccount()
  const [tab, setTab] = useState<'browse' | 'my-nfts' | 'mint'>('browse')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [liked, setLiked] = useState<Set<number>>(new Set())

  const toggleLike = (id: number) => {
    setLiked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>NFT Marketplace</h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>Browse, mint, and trade NFTs on Polygon</p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setView('grid')} style={{ ...cs.btn, background: view === 'grid' ? 'rgba(99,102,241,0.2)' : 'transparent', color: view === 'grid' ? '#a5b4fc' : 'rgba(255,255,255,0.3)', padding: '6px 8px' }}><Grid size={16} /></button>
          <button onClick={() => setView('list')} style={{ ...cs.btn, background: view === 'list' ? 'rgba(99,102,241,0.2)' : 'transparent', color: view === 'list' ? '#a5b4fc' : 'rgba(255,255,255,0.3)', padding: '6px 8px' }}><List size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', width: 'fit-content' }}>
        {[{ k: 'browse' as const, l: 'Browse' }, { k: 'my-nfts' as const, l: 'My NFTs' }, { k: 'mint' as const, l: 'Mint' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={cs.tab(tab === t.k)}>{t.l}</button>
        ))}
      </div>

      {/* Collections banner */}
      {tab === 'browse' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {collections.map((c, i) => (
              <div key={i} style={{ ...cs.card, padding: '16px', cursor: 'pointer' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{c.image}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{c.items.toLocaleString()} items</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Floor: <span style={{ color: '#34d399' }}>{c.floor}</span></span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Vol: <span style={{ color: '#818cf8' }}>{c.volume}</span></span>
                </div>
              </div>
            ))}
          </div>

          {/* NFT grid */}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'grid' ? 'repeat(3, 1fr)' : '1fr', gap: '12px' }}>
            {nfts.map(nft => (
              <div key={nft.id} style={{ ...cs.card, overflow: 'hidden' }}>
                {/* NFT "image" */}
                <div style={{ height: view === 'grid' ? '160px' : '80px', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: view === 'grid' ? '48px' : '32px' }}>
                  {nft.emoji}
                </div>
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{nft.name}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{nft.collection}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleLike(nft.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', color: liked.has(nft.id) ? '#ef4444' : 'rgba(255,255,255,0.25)', fontSize: '11px' }}>
                      <Heart size={14} fill={liked.has(nft.id) ? '#ef4444' : 'none'} /> {nft.likes + (liked.has(nft.id) ? 1 : 0)}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Price</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>{nft.price}</div>
                    </div>
                    <button style={{ ...cs.btn, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '8px 14px' }}>
                      <ShoppingBag size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Buy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'my-nfts' && (
        <div style={{ ...cs.card, padding: '40px', textAlign: 'center' }}>
          <Image size={40} style={{ margin: '0 auto 12px', color: 'rgba(255,255,255,0.15)' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>No NFTs found</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{address ? 'Browse the marketplace and purchase your first NFT' : 'Connect your wallet to view your NFTs'}</p>
        </div>
      )}

      {tab === 'mint' && (
        <div style={{ ...cs.card, padding: '20px', maxWidth: '480px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Mint NFT</h3>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: '6px' }}>NAME</div>
            <input placeholder="My NFT" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: '6px' }}>DESCRIPTION</div>
            <textarea rows={3} placeholder="Describe your NFT..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: '6px' }}>IMAGE</div>
            <div style={{ padding: '24px', borderRadius: '12px', border: '2px dashed rgba(255,255,255,0.08)', textAlign: 'center', cursor: 'pointer' }}>
              <Plus size={24} style={{ margin: '0 auto 8px', color: 'rgba(255,255,255,0.2)' }} />
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Upload image (PNG, JPG, GIF)</p>
            </div>
          </div>
          <button style={{ ...cs.btn, width: '100%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '12px', fontSize: '14px' }}>
            <Tag size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Mint NFT
          </button>
        </div>
      )}
    </div>
  )
}