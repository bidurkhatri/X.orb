import { useState, useEffect, useRef, useCallback } from 'react'
import { FileText, Plus, Trash2, Search, Clock, Pin, Archive, Edit3, Save, Bold, Italic, List } from 'lucide-react'

interface Note {
    id: string
    title: string
    content: string
    pinned: boolean
    createdAt: number
    updatedAt: number
}

const STORAGE_KEY = 'sylos_notes'

function loadNotes(): Note[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveNotes(notes: Note[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)) }

export default function NotesApp() {
    const [notes, setNotes] = useState<Note[]>(loadNotes)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const textRef = useRef<HTMLTextAreaElement>(null)

    const activeNote = notes.find(n => n.id === activeId)

    useEffect(() => { saveNotes(notes) }, [notes])

    const createNote = useCallback(() => {
        const note: Note = {
            id: `note_${Date.now()}`,
            title: 'Untitled Note',
            content: '',
            pinned: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
        setNotes(p => [note, ...p])
        setActiveId(note.id)
        setTimeout(() => textRef.current?.focus(), 50)
    }, [])

    const updateNote = useCallback((id: string, updates: Partial<Note>) => {
        setNotes(p => p.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n))
    }, [])

    const deleteNote = useCallback((id: string) => {
        setNotes(p => p.filter(n => n.id !== id))
        if (activeId === id) setActiveId(null)
    }, [activeId])

    const togglePin = useCallback((id: string) => {
        setNotes(p => p.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))
    }, [])

    const filtered = notes
        .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)

    const timeAgo = (ts: number) => {
        const s = Math.floor((Date.now() - ts) / 1000)
        if (s < 60) return 'Just now'
        if (s < 3600) return `${Math.floor(s / 60)}m ago`
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return (
        <div style={{ height: '100%', display: 'flex', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Sidebar */}
            <div style={{ width: '240px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
                {/* Search + New */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." style={{
                            width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', fontSize: '11px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                        }} />
                    </div>
                    <button onClick={createNote} style={{
                        width: '100%', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit',
                    }}>
                        <Plus size={14} /> New Note
                    </button>
                </div>

                {/* Note list */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>
                            {search ? 'No matching notes' : 'No notes yet'}
                        </div>
                    )}
                    {filtered.map(n => (
                        <button key={n.id} onClick={() => { setActiveId(n.id); setTimeout(() => textRef.current?.focus(), 50) }} style={{
                            width: '100%', padding: '12px 14px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                            background: activeId === n.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                            borderLeft: activeId === n.id ? '3px solid #6366f1' : '3px solid transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.1s',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                {n.pinned && <Pin size={10} color="#f59e0b" />}
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.title || 'Untitled'}</span>
                            </div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.content.slice(0, 80) || 'Empty note'}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={8} /> {timeAgo(n.updatedAt)}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Count */}
                <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>
                    {notes.length} note{notes.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {activeNote ? (
                    <>
                        {/* Toolbar */}
                        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <input
                                value={activeNote.title}
                                onChange={e => updateNote(activeNote.id, { title: e.target.value })}
                                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit', flex: 1 }}
                                placeholder="Note title..."
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => togglePin(activeNote.id)} title="Pin" style={{ background: activeNote.pinned ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: activeNote.pinned ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>
                                    <Pin size={14} />
                                </button>
                                <button onClick={() => deleteNote(activeNote.id)} title="Delete" style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Content editor */}
                        <textarea
                            ref={textRef}
                            value={activeNote.content}
                            onChange={e => updateNote(activeNote.id, { content: e.target.value })}
                            placeholder="Start typing your note..."
                            style={{
                                flex: 1, padding: '20px 24px', background: 'none', border: 'none', outline: 'none', resize: 'none',
                                color: '#e2e8f0', fontSize: '13px', fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1.8,
                                caretColor: '#818cf8',
                            }}
                        />

                        {/* Footer */}
                        <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '10px', color: 'rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{activeNote.content.length} chars · {activeNote.content.split(/\s+/).filter(Boolean).length} words</span>
                            <span>Last edited {timeAgo(activeNote.updatedAt)}</span>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'rgba(255,255,255,0.15)' }}>
                        <FileText size={40} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>Select a note or create a new one</span>
                        <button onClick={createNote} style={{
                            padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            <Plus size={12} /> New Note
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
