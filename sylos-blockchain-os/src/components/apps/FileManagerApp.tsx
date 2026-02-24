import { useState, useEffect, useRef } from 'react'
import { FolderOpen, File as FileIcon, Upload, Download, Trash2, Share2, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { supabase } from '../../lib/supabase'
import { encryptFile, pinToIPFS, getGatewayUrl } from '../../services/ipfs/ipfsService'
import { localSyncService } from '../../services/db/LocalSyncService'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface VFSFile { id: string; file_name: string; file_size: number; file_type: string; ipfs_cid: string; upload_timestamp: string }

const formatBytes = (b: number) => {
  if (!b) return '0 B'
  const k = 1024, s = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`
}

export default function FileManagerApp() {
  const { address, isConnected } = useAccount()
  const [files, setFiles] = useState<VFSFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const fetchFiles = async () => {
    if (!address) return
    setLoading(true)
    try {
      const { data } = await supabase.from('decentralized_files').select('*').eq('user_id', address).order('upload_timestamp', { ascending: false })
      if (data) setFiles(data)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { fetchFiles() }, [isConnected, address])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !address) return
    setUploading(true)
    try {
      const enc = await encryptFile(f, address)
      const res = await pinToIPFS(enc, f.name)
      if (!res.success || !res.cid) throw new Error(res.error || 'Pin failed')
      const rec = { user_id: address, file_name: f.name, file_size: f.size, file_type: f.name.split('.').pop() || '?', ipfs_cid: res.cid, encrypted: true, is_public: false }
      if (!navigator.onLine) {
        await localSyncService.queueAction('VFS_UPLOAD', rec)
        setFiles(p => [{ id: Math.random().toString(), ...rec, upload_timestamp: new Date().toISOString() } as any, ...p])
      } else {
        const { data } = await supabase.from('decentralized_files').insert([rec]).select()
        if (data?.[0]) setFiles(p => [data[0], ...p])
        else setFiles(p => [{ id: Math.random().toString(), ...rec, upload_timestamp: new Date().toISOString() } as any, ...p])
      }
      toast.success('File added to VFS')
    } catch (err: any) { toast.error(err.message) }
    finally { setUploading(false); if (ref.current) ref.current.value = '' }
  }

  const handleDl = (cid: string) => { window.open(getGatewayUrl(cid), '_blank') }
  const handleDel = async (id: string) => {
    await supabase.from('decentralized_files').delete().eq('id', id)
    setFiles(p => p.filter(f => f.id !== id))
  }

  if (!isConnected) {
    return (
      <div style={{ height: '100%', background: '#0f1328', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <FolderOpen size={48} color="rgba(255,255,255,0.15)" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Wallet Disconnected</h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Connect to access your encrypted IPFS files</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FolderOpen size={20} color="#818cf8" />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>Zero-Knowledge VFS</h2>
        </div>
        <div>
          <input type="file" ref={ref} onChange={handleUpload} style={{ display: 'none' }} />
          <button disabled={uploading} onClick={() => ref.current?.click()} style={{
            padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '12px', fontWeight: 600,
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', opacity: uploading ? 0.5 : 1,
          }}>
            {uploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
            {uploading ? 'Encrypting...' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Files */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Loader2 size={24} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : files.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
            <FolderOpen size={48} color="rgba(255,255,255,0.08)" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Vault Empty</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.15)', margin: 0, textAlign: 'center', maxWidth: '300px' }}>Upload your first file to encrypt and pin it to IPFS</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileIcon size={18} color="#818cf8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                    <span>{formatBytes(f.file_size)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.ipfs_cid.substring(0, 12)}...</span>
                    <span>{format(new Date(f.upload_timestamp), 'PP')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleDl(f.ipfs_cid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '6px' }}><Download size={14} /></button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '6px' }}><Share2 size={14} /></button>
                  <button onClick={() => handleDel(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.4)', padding: '6px' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
