/**
 * @file AgentIDEApp.tsx
 * @description SylOS Agent IDE — VS Code-inspired coding environment
 *
 * Full IDE experience with:
 * - Activity bar (Files, Search, Git, Extensions)
 * - File explorer with folder tree
 * - Multi-tab editing with Monaco Editor
 * - Breadcrumb path navigation
 * - Integrated terminal (xterm.js)
 * - Minimap, line numbers, bracket matching
 * - File search across workspace
 * - Status bar with language, line/col, encoding
 *
 * Agents write code via generate_code tool → files appear here instantly.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { eventBus } from '@/services/EventBus'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { executionEngine } from '@/services/agent/ExecutionEngine'

/* ═══════════════════════════════
   ═══  VIRTUAL FS  ═══════════════
   ═══════════════════════════════ */

const VFS_KEY = 'sylos_vfs'

interface VFile {
    path: string
    content: string
    language: string
    author: string
    authorName: string
    createdAt: number
    updatedAt: number
}

function loadVFS(): VFile[] {
    try {
        const raw = localStorage.getItem(VFS_KEY)
        return raw ? JSON.parse(raw) : getDefaultFiles()
    } catch { return getDefaultFiles() }
}

function saveVFS(files: VFile[]) {
    try { localStorage.setItem(VFS_KEY, JSON.stringify(files)) } catch { /* quota */ }
}

function getDefaultFiles(): VFile[] {
    return [
        {
            path: '/welcome.md',
            content: `# Welcome to the SylOS IDE 🚀\n\nThis is your in-browser coding environment powered by Monaco Editor.\n\n## How it works\n- **Agents** can write code here using the \`generate_code\` tool\n- **You** can create, edit, and organize files\n- **Run** code with the ▶ button or Ctrl+Enter\n\n## Try it out\nCreate a new file using the + button in the file explorer.\n`,
            language: 'markdown',
            author: 'system',
            authorName: 'SylOS',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            path: '/contracts/HelloWorld.sol',
            content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract HelloWorld {\n    string public message;\n\n    constructor(string memory _message) {\n        message = _message;\n    }\n\n    function setMessage(string memory _newMessage) public {\n        message = _newMessage;\n    }\n}\n`,
            language: 'sol',
            author: 'system',
            authorName: 'SylOS',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            path: '/scripts/hello.js',
            content: `// Example JavaScript — click ▶ RUN to execute\nconsole.log("Hello from SylOS IDE!");\nconsole.log("Current time:", new Date().toISOString());\n\nconst fibonacci = (n) => n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2);\nfor (let i = 0; i < 10; i++) {\n    console.log(\`fib(\${i}) = \${fibonacci(i)}\`);\n}\n`,
            language: 'javascript',
            author: 'system',
            authorName: 'SylOS',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    ]
}

function detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const map: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        sol: 'sol', json: 'json', md: 'markdown', py: 'python',
        css: 'css', html: 'html', yml: 'yaml', yaml: 'yaml',
        sh: 'shell', bash: 'shell', txt: 'plaintext', rs: 'rust',
        go: 'go', rb: 'ruby', toml: 'toml', env: 'plaintext',
    }
    return map[ext] || 'plaintext'
}

/* ═══════════════════════════════
   ═══  TREE BUILDER  ═════════════
   ═══════════════════════════════ */

interface TreeNode {
    name: string
    path: string
    isDir: boolean
    children?: TreeNode[]
}

function buildTree(files: VFile[]): TreeNode[] {
    const root: TreeNode[] = []
    for (const file of files) {
        const parts = file.path.split('/').filter(Boolean)
        let current = root
        let currentPath = ''
        for (let i = 0; i < parts.length; i++) {
            currentPath += '/' + parts[i]
            const isLast = i === parts.length - 1
            if (isLast) {
                current.push({ name: parts[i]!, path: file.path, isDir: false })
            } else {
                let dir = current.find(n => n.isDir && n.name === parts[i])
                if (!dir) {
                    dir = { name: parts[i]!, path: currentPath, isDir: true, children: [] }
                    current.push(dir)
                }
                current = dir.children!
            }
        }
    }
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
            return a.name.localeCompare(b.name)
        })
        for (const n of nodes) { if (n.children) sortNodes(n.children) }
    }
    sortNodes(root)
    return root
}

/* ═══════════════════════════════
   ═══  ICONS (VS Code style) ════
   ═══════════════════════════════ */

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
    ts: { icon: 'TS', color: '#3178c6' },
    tsx: { icon: 'TX', color: '#3178c6' },
    js: { icon: 'JS', color: '#f7df1e' },
    jsx: { icon: 'JX', color: '#f7df1e' },
    sol: { icon: '◆', color: '#6b8aaa' },
    json: { icon: '{}', color: '#cbcb41' },
    md: { icon: 'M↓', color: '#519aba' },
    py: { icon: 'Py', color: '#4584b6' },
    css: { icon: '#', color: '#42a5f5' },
    html: { icon: '<>', color: '#e44d26' },
    yml: { icon: 'Y', color: '#cb171e' },
    yaml: { icon: 'Y', color: '#cb171e' },
    sh: { icon: '$', color: '#89e051' },
    rs: { icon: 'Rs', color: '#dea584' },
    go: { icon: 'Go', color: '#00add8' },
    toml: { icon: 'T', color: '#9c4221' },
}

function getFileIcon(name: string): { icon: string; color: string } {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return FILE_ICONS[ext] || { icon: '📄', color: '#8b949e' }
}

/* ═══════════════════════════════
   ═══  ACTIVITY BAR ITEMS  ══════
   ═══════════════════════════════ */

type SidebarPanel = 'explorer' | 'search' | 'source' | 'extensions'

const ACTIVITY_ITEMS: { id: SidebarPanel; icon: string; label: string }[] = [
    { id: 'explorer', icon: '📁', label: 'Explorer' },
    { id: 'search', icon: '🔍', label: 'Search' },
    { id: 'source', icon: '⎇', label: 'Source Control' },
    { id: 'extensions', icon: '🧩', label: 'Extensions' },
]

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ══════════
   ═══════════════════════════════ */

interface Tab {
    path: string
    modified: boolean
}

const AgentIDEApp: React.FC = () => {
    const [files, setFiles] = useState<VFile[]>(loadVFS)
    const [tabs, setTabs] = useState<Tab[]>([{ path: '/welcome.md', modified: false }])
    const [activeTab, setActiveTab] = useState('/welcome.md')
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/contracts', '/scripts']))
    const [showNewFile, setShowNewFile] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const newFileRef = useRef<HTMLInputElement>(null)
    const [activePanel, setActivePanel] = useState<SidebarPanel>('explorer')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })

    // Terminal state
    const [isExecuting, setIsExecuting] = useState(false)
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const [showTerminal, setShowTerminal] = useState(false)
    const [terminalHeight, setTerminalHeight] = useState(200)
    const editorRef = useRef<any>(null)

    // Save to localStorage whenever files change
    useEffect(() => { saveVFS(files) }, [files])

    // Focus new file input when shown
    useEffect(() => {
        if (showNewFile && newFileRef.current) newFileRef.current.focus()
    }, [showNewFile])

    // ── Terminal Initialization ──
    useEffect(() => {
        if (showTerminal && terminalRef.current && !xtermRef.current) {
            const term = new Terminal({
                theme: {
                    background: '#1e1e2e',
                    foreground: '#cdd6f4',
                    cursor: '#f5e0dc',
                    selectionBackground: '#45475a',
                    black: '#45475a',
                    red: '#f38ba8',
                    green: '#a6e3a1',
                    yellow: '#f9e2af',
                    blue: '#89b4fa',
                    magenta: '#cba6f7',
                    cyan: '#94e2d5',
                    white: '#bac2de',
                },
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
                fontSize: 13,
                lineHeight: 1.4,
                convertEol: true,
                cursorBlink: true,
                cursorStyle: 'bar',
            })
            const fitAddon = new FitAddon()
            term.loadAddon(fitAddon)
            term.open(terminalRef.current)
            setTimeout(() => fitAddon.fit(), 50)

            term.writeln('\x1b[38;2;137;180;250m┌──────────────────────────────────────┐\x1b[0m')
            term.writeln('\x1b[38;2;137;180;250m│\x1b[0m  \x1b[1;38;2;203;166;247mSylOS Terminal\x1b[0m                       \x1b[38;2;137;180;250m│\x1b[0m')
            term.writeln('\x1b[38;2;137;180;250m│\x1b[0m  \x1b[38;2;108;112;134mType commands or run code with ▶\x1b[0m     \x1b[38;2;137;180;250m│\x1b[0m')
            term.writeln('\x1b[38;2;137;180;250m└──────────────────────────────────────┘\x1b[0m')
            term.writeln('')

            xtermRef.current = term
            fitAddonRef.current = fitAddon

            executionEngine.setLogCallback((str) => {
                if (xtermRef.current) xtermRef.current.write(str)
            })

            const resizeObs = new ResizeObserver(() => fitAddon.fit())
            resizeObs.observe(terminalRef.current)
            return () => resizeObs.disconnect()
        }
    }, [showTerminal])

    // ── Listen for agent-generated files (both old and new event types) ──
    useEffect(() => {
        const unsub1 = eventBus.on('agent:tool_executed', (event) => {
            if (event.payload?.toolName === 'generate_code') {
                const { filename, code, language: lang } = event.payload
                if (!filename || !code) return
                const path = filename.startsWith('/') ? filename : '/' + filename
                addOrUpdateFile(path, code, lang || detectLanguage(filename), event.source, event.sourceName)
            }
        })
        const unsub2 = eventBus.on('ide:file_created', (event) => {
            // Reload VFS from storage to pick up agent-written files
            setFiles(loadVFS())
            if (event.payload?.path) {
                const p = event.payload.path
                setTabs(prev => prev.some(t => t.path === p) ? prev : [...prev, { path: p, modified: false }])
                setActiveTab(p)
            }
        })
        return () => { unsub1(); unsub2() }
    }, [])

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                runCode()
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault()
                setShowTerminal(v => !v)
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault()
                setSidebarOpen(v => !v)
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
                e.preventDefault()
                setActivePanel('search')
                setSidebarOpen(true)
            }
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [])

    const addOrUpdateFile = useCallback((path: string, code: string, lang: string, author: string, authorName: string) => {
        setFiles(prev => {
            const existing = prev.findIndex(f => f.path === path)
            const nf: VFile = {
                path, content: code, language: lang, author, authorName,
                createdAt: existing >= 0 ? prev[existing]!.createdAt : Date.now(),
                updatedAt: Date.now(),
            }
            if (existing >= 0) { const u = [...prev]; u[existing] = nf; return u }
            return [...prev, nf]
        })
        setTabs(prev => prev.some(t => t.path === path) ? prev : [...prev, { path, modified: false }])
        setActiveTab(path)
    }, [])

    // ── File operations ──
    const getActiveFile = useCallback(() => files.find(f => f.path === activeTab) || null, [files, activeTab])

    const runCode = async () => {
        const af = getActiveFile()
        if (!af) return
        setShowTerminal(true)
        setIsExecuting(true)
        setTimeout(async () => {
            if (xtermRef.current) {
                xtermRef.current.writeln(`\r\n\x1b[38;2;166;227;161m▶ Running: ${af.path}\x1b[0m`)
                xtermRef.current.writeln('\x1b[38;2;88;91;112m' + '─'.repeat(40) + '\x1b[0m')
            }
            await executionEngine.execute(af.content, af.language)
            if (xtermRef.current) {
                xtermRef.current.writeln('\x1b[38;2;88;91;112m' + '─'.repeat(40) + '\x1b[0m')
                xtermRef.current.writeln('\x1b[38;2;166;227;161m✓ Done\x1b[0m\r\n')
            }
            setIsExecuting(false)
        }, 100)
    }

    const handleContentChange = useCallback((value: string | undefined) => {
        if (!value) return
        setFiles(prev => prev.map(f => f.path === activeTab ? { ...f, content: value, updatedAt: Date.now() } : f))
        setTabs(prev => prev.map(t => t.path === activeTab ? { ...t, modified: true } : t))
    }, [activeTab])

    const openFile = useCallback((path: string) => {
        if (!tabs.some(t => t.path === path)) setTabs(prev => [...prev, { path, modified: false }])
        setActiveTab(path)
    }, [tabs])

    const closeTab = useCallback((path: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setTabs(prev => {
            const next = prev.filter(t => t.path !== path)
            if (activeTab === path && next.length > 0) setActiveTab(next[next.length - 1]!.path)
            return next
        })
    }, [activeTab])

    const createFile = useCallback(() => {
        if (!newFileName.trim()) return
        const path = newFileName.startsWith('/') ? newFileName : '/' + newFileName
        if (files.some(f => f.path === path)) { setShowNewFile(false); setNewFileName(''); openFile(path); return }
        setFiles(prev => [...prev, { path, content: '', language: detectLanguage(path), author: 'user', authorName: 'You', createdAt: Date.now(), updatedAt: Date.now() }])
        setShowNewFile(false)
        setNewFileName('')
        openFile(path)
    }, [newFileName, files, openFile])

    const deleteFile = useCallback((path: string) => {
        setFiles(prev => prev.filter(f => f.path !== path))
        setTabs(prev => prev.filter(t => t.path !== path))
        if (activeTab === path) {
            const remaining = tabs.filter(t => t.path !== path)
            if (remaining.length > 0) setActiveTab(remaining[0]!.path)
        }
    }, [activeTab, tabs])

    const toggleDir = useCallback((path: string) => {
        setExpandedDirs(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n })
    }, [])

    // Search results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return []
        const q = searchQuery.toLowerCase()
        const results: { path: string; line: number; text: string }[] = []
        for (const f of files) {
            const lines = f.content.split('\n')
            lines.forEach((l, i) => {
                if (l.toLowerCase().includes(q)) {
                    results.push({ path: f.path, line: i + 1, text: l.trim().slice(0, 100) })
                }
            })
        }
        return results.slice(0, 100)
    }, [searchQuery, files])

    // ── TreeNode renderer ──
    const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
        if (node.isDir) {
            const expanded = expandedDirs.has(node.path)
            return (
                <div key={node.path}>
                    <div
                        onClick={() => toggleDir(node.path)}
                        style={{
                            padding: '2px 0', paddingLeft: 12 + depth * 16,
                            cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                            color: '#cdd6f4', userSelect: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <span style={{ fontSize: 10, width: 14, textAlign: 'center', color: '#6c7086' }}>{expanded ? '▾' : '▸'}</span>
                        <span style={{ fontSize: 12 }}>📁</span>
                        <span style={{ fontWeight: 500 }}>{node.name}</span>
                    </div>
                    {expanded && node.children?.map(c => renderNode(c, depth + 1))}
                </div>
            )
        }

        const isActive = activeTab === node.path
        const fi = getFileIcon(node.name)
        const authorFile = files.find(f => f.path === node.path)
        const isAgent = authorFile?.author && authorFile.author !== 'user' && authorFile.author !== 'system'

        return (
            <div
                key={node.path}
                onClick={() => openFile(node.path)}
                onContextMenu={e => { e.preventDefault(); if (confirm(`Delete ${node.name}?`)) deleteFile(node.path) }}
                style={{
                    padding: '2px 0', paddingLeft: 28 + depth * 16,
                    cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                    color: isActive ? '#cdd6f4' : '#9ca3af',
                    background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                    userSelect: 'none',
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
                <span style={{ fontSize: 10, fontWeight: 700, color: fi.color, minWidth: 16, textAlign: 'center', fontFamily: 'monospace' }}>{fi.icon}</span>
                <span style={{ flex: 1 }}>{node.name}</span>
                {isAgent && <span style={{ fontSize: 9, color: '#cba6f7', marginRight: 8 }}>●</span>}
            </div>
        )
    }

    const tree = buildTree(files)
    const activeFile = getActiveFile()
    const breadcrumbs = activeTab ? activeTab.split('/').filter(Boolean) : []
    const langLabel = activeFile?.language?.toUpperCase() || 'TEXT'
    const isRunnable = activeFile && ['python', 'javascript', 'typescript'].includes(activeFile.language)

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: '#1e1e2e', color: '#cdd6f4',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontSize: 13,
        }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* ═══ Activity Bar (thin icon strip) ═══ */}
                <div style={{
                    width: 48, background: '#11111b', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', paddingTop: 4, borderRight: '1px solid #181825',
                    flexShrink: 0,
                }}>
                    {ACTIVITY_ITEMS.map(item => (
                        <div
                            key={item.id}
                            title={item.label}
                            onClick={() => {
                                if (activePanel === item.id && sidebarOpen) setSidebarOpen(false)
                                else { setActivePanel(item.id); setSidebarOpen(true) }
                            }}
                            style={{
                                width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18, cursor: 'pointer', borderRadius: 6, marginBottom: 2,
                                background: activePanel === item.id && sidebarOpen ? 'rgba(99,102,241,0.15)' : 'transparent',
                                borderLeft: activePanel === item.id && sidebarOpen ? '2px solid #cba6f7' : '2px solid transparent',
                                color: activePanel === item.id && sidebarOpen ? '#cdd6f4' : '#585b70',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (!(activePanel === item.id && sidebarOpen)) e.currentTarget.style.color = '#a6adc8' }}
                            onMouseLeave={e => { if (!(activePanel === item.id && sidebarOpen)) e.currentTarget.style.color = '#585b70' }}
                        >
                            {item.icon}
                        </div>
                    ))}

                    {/* Bottom icons */}
                    <div style={{ marginTop: 'auto', marginBottom: 8, textAlign: 'center' }}>
                        <div
                            onClick={() => setShowTerminal(v => !v)}
                            title="Toggle Terminal (Ctrl+`)"
                            style={{
                                width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, cursor: 'pointer', borderRadius: 6,
                                color: showTerminal ? '#a6e3a1' : '#585b70',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#a6adc8'}
                            onMouseLeave={e => e.currentTarget.style.color = showTerminal ? '#a6e3a1' : '#585b70'}
                        >
                            {'>_'}
                        </div>
                    </div>
                </div>

                {/* ═══ Sidebar ═══ */}
                {sidebarOpen && (
                    <div style={{
                        width: 240, background: '#181825', borderRight: '1px solid #313244',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
                    }}>
                        {/* Sidebar Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderBottom: '1px solid #313244',
                        }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#a6adc8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                                {ACTIVITY_ITEMS.find(i => i.id === activePanel)?.label}
                            </span>
                            {activePanel === 'explorer' && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <span onClick={() => setShowNewFile(true)} style={{ cursor: 'pointer', fontSize: 14, color: '#89b4fa' }} title="New File">+</span>
                                </div>
                            )}
                        </div>

                        {/* Panel content */}
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {activePanel === 'explorer' && (
                                <>
                                    {showNewFile && (
                                        <div style={{ padding: '6px 12px' }}>
                                            <input
                                                ref={newFileRef}
                                                value={newFileName}
                                                onChange={e => setNewFileName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') createFile()
                                                    if (e.key === 'Escape') { setShowNewFile(false); setNewFileName('') }
                                                }}
                                                onBlur={() => { setShowNewFile(false); setNewFileName('') }}
                                                placeholder="/path/to/file.ts"
                                                style={{
                                                    width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 4,
                                                    background: '#1e1e2e', border: '1px solid #89b4fa', color: '#cdd6f4',
                                                    outline: 'none', fontFamily: 'inherit',
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div style={{ padding: '4px 0' }}>
                                        {tree.map(node => renderNode(node))}
                                    </div>
                                </>
                            )}

                            {activePanel === 'search' && (
                                <div style={{ padding: '8px 12px' }}>
                                    <input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search in files..."
                                        style={{
                                            width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4,
                                            background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4',
                                            outline: 'none', marginBottom: 8, fontFamily: 'inherit',
                                        }}
                                        onFocus={e => e.currentTarget.style.borderColor = '#89b4fa'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#313244'}
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <div style={{ fontSize: 11, color: '#6c7086', marginBottom: 8 }}>
                                            {searchResults.length} results in {new Set(searchResults.map(r => r.path)).size} files
                                        </div>
                                    )}
                                    {searchResults.map((r, i) => (
                                        <div
                                            key={`${r.path}:${r.line}:${i}`}
                                            onClick={() => openFile(r.path)}
                                            style={{
                                                padding: '3px 6px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
                                                color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: 1,
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ color: '#89b4fa', fontSize: 11 }}>{r.path}:{r.line}</span>
                                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6c7086', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activePanel === 'source' && (
                                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#585b70', fontSize: 12 }}>
                                    <div style={{ fontSize: 28, marginBottom: 8 }}>⎇</div>
                                    <div>Source control integrated with</div>
                                    <div style={{ color: '#89b4fa', marginTop: 4 }}>SylOS VFS</div>
                                    <div style={{ marginTop: 12, fontSize: 11, color: '#45475a' }}>{files.length} files tracked</div>
                                </div>
                            )}

                            {activePanel === 'extensions' && (
                                <div style={{ padding: '12px' }}>
                                    {[
                                        { name: 'Solidity', desc: 'Smart contract support', active: true },
                                        { name: 'Python', desc: 'Pyodide execution', active: true },
                                        { name: 'AI Agent Tools', desc: 'generate_code, execute_code', active: true },
                                        { name: 'Monaco Themes', desc: 'Catppuccin Mocha', active: true },
                                    ].map(ext => (
                                        <div key={ext.name} style={{
                                            padding: '8px', marginBottom: 6, borderRadius: 6,
                                            background: 'rgba(255,255,255,0.02)', border: '1px solid #313244',
                                        }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#cdd6f4' }}>{ext.name}</div>
                                            <div style={{ fontSize: 11, color: '#6c7086', marginTop: 2 }}>{ext.desc}</div>
                                            <div style={{ marginTop: 4, fontSize: 10, color: ext.active ? '#a6e3a1' : '#f38ba8' }}>
                                                {ext.active ? '● Enabled' : '○ Disabled'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ Main Editor Area ═══ */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                    {/* Tab bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', background: '#181825',
                        borderBottom: '1px solid #313244', minHeight: 35, overflow: 'auto',
                    }}>
                        {tabs.map(tab => {
                            const fname = tab.path.split('/').pop() || tab.path
                            const fi = getFileIcon(fname)
                            const isActive = activeTab === tab.path
                            return (
                                <div
                                    key={tab.path}
                                    onClick={() => setActiveTab(tab.path)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                                        background: isActive ? '#1e1e2e' : 'transparent',
                                        borderRight: '1px solid #11111b',
                                        color: isActive ? '#cdd6f4' : '#6c7086',
                                        borderTop: isActive ? '1px solid #cba6f7' : '1px solid transparent',
                                        borderBottom: isActive ? 'none' : '1px solid #313244',
                                        transition: 'all 0.1s',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                                >
                                    <span style={{ fontSize: 9, fontWeight: 700, color: fi.color, fontFamily: 'monospace' }}>{fi.icon}</span>
                                    <span>{fname}</span>
                                    {tab.modified && <span style={{ color: '#f9e2af', fontSize: 8 }}>●</span>}
                                    <span
                                        onClick={e => closeTab(tab.path, e)}
                                        style={{ fontSize: 12, opacity: 0.3, padding: '0 2px', marginLeft: 4, lineHeight: 1 }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
                                    >×</span>
                                </div>
                            )
                        })}
                    </div>

                    {activeFile ? (
                        <>
                            {/* Breadcrumb bar */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '4px 16px', background: '#1e1e2e', borderBottom: '1px solid #2a2a3c',
                                fontSize: 12, color: '#585b70',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {breadcrumbs.map((crumb, i) => (
                                        <React.Fragment key={i}>
                                            {i > 0 && <span style={{ margin: '0 2px', color: '#45475a' }}>›</span>}
                                            <span style={{ color: i === breadcrumbs.length - 1 ? '#cdd6f4' : '#6c7086' }}>{crumb}</span>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {activeFile.author !== 'user' && activeFile.author !== 'system' && (
                                        <span style={{ fontSize: 10, color: '#cba6f7', display: 'flex', alignItems: 'center', gap: 3 }}>
                                            🤖 {activeFile.authorName}
                                        </span>
                                    )}
                                    {isRunnable && (
                                        <button
                                            onClick={runCode}
                                            disabled={isExecuting}
                                            style={{
                                                background: isExecuting ? '#45475a' : '#a6e3a1',
                                                color: isExecuting ? '#a6adc8' : '#11111b',
                                                border: 'none', padding: '3px 10px', borderRadius: 4,
                                                fontSize: 11, fontWeight: 700, cursor: isExecuting ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {isExecuting ? '⏳ Running...' : '▶ Run'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Editor */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <Editor
                                    theme="vs-dark"
                                    language={activeFile.language}
                                    value={activeFile.content}
                                    onChange={handleContentChange}
                                    onMount={(editor) => {
                                        editorRef.current = editor
                                        editor.onDidChangeCursorPosition(e => {
                                            setCursorPos({ line: e.position.lineNumber, col: e.position.column })
                                        })
                                    }}
                                    options={{
                                        fontSize: 14,
                                        fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
                                        fontLigatures: true,
                                        minimap: { enabled: true, maxColumn: 80, renderCharacters: false },
                                        scrollBeyondLastLine: false,
                                        renderLineHighlight: 'all',
                                        padding: { top: 12 },
                                        automaticLayout: true,
                                        wordWrap: activeFile.language === 'markdown' ? 'on' : 'off',
                                        bracketPairColorization: { enabled: true },
                                        guides: { bracketPairs: true, indentation: true },
                                        smoothScrolling: true,
                                        cursorBlinking: 'smooth',
                                        cursorSmoothCaretAnimation: 'on',
                                        lineNumbers: 'on',
                                        renderWhitespace: 'selection',
                                        roundedSelection: true,
                                        links: true,
                                        colorDecorators: true,
                                        suggest: { showKeywords: true },
                                        tabSize: 4,
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        /* Welcome screen when no file is open */
                        <div style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#1e1e2e',
                        }}>
                            <div style={{ textAlign: 'center', maxWidth: 400 }}>
                                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⌨️</div>
                                <div style={{ fontSize: 18, fontWeight: 600, color: '#585b70', marginBottom: 8 }}>SylOS IDE</div>
                                <div style={{ fontSize: 12, color: '#45475a', lineHeight: 1.8 }}>
                                    <div>Open a file from the explorer</div>
                                    <div>or ask an agent to write code</div>
                                    <div style={{ marginTop: 12, color: '#585b70' }}>
                                        <span style={{ color: '#89b4fa' }}>Ctrl+B</span> Toggle sidebar · <span style={{ color: '#89b4fa' }}>Ctrl+`</span> Terminal · <span style={{ color: '#89b4fa' }}>Ctrl+Enter</span> Run
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ Terminal Panel ═══ */}
                    {showTerminal && (
                        <div style={{
                            height: terminalHeight, borderTop: '1px solid #313244',
                            display: 'flex', flexDirection: 'column', background: '#1e1e2e',
                            flexShrink: 0,
                        }}>
                            {/* Terminal resize handle */}
                            <div
                                style={{ height: 4, cursor: 'ns-resize', background: 'transparent' }}
                                onMouseDown={e => {
                                    const startY = e.clientY
                                    const startH = terminalHeight
                                    const onMove = (ev: MouseEvent) => {
                                        const delta = startY - ev.clientY
                                        setTerminalHeight(Math.max(100, Math.min(500, startH + delta)))
                                    }
                                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                                    document.addEventListener('mousemove', onMove)
                                    document.addEventListener('mouseup', onUp)
                                }}
                            />
                            {/* Terminal header */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '4px 12px', background: '#181825', borderBottom: '1px solid #313244', fontSize: 12,
                            }}>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <span style={{
                                        color: '#cba6f7', fontWeight: 600, textTransform: 'uppercase',
                                        fontSize: 11, letterSpacing: 0.5,
                                    }}>Terminal</span>
                                    <span style={{ fontSize: 10, color: '#45475a' }}>SylOS Shell</span>
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <span style={{ cursor: 'pointer', color: '#6c7086', fontSize: 12 }} onClick={() => xtermRef.current?.clear()} title="Clear">⌫</span>
                                    <span style={{ cursor: 'pointer', color: '#6c7086', fontSize: 14 }} onClick={() => setShowTerminal(false)} title="Close">×</span>
                                </div>
                            </div>
                            <div ref={terminalRef} style={{ flex: 1, padding: '4px 8px', overflow: 'hidden' }} />
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Status Bar ═══ */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 12px', background: '#181825', borderTop: '1px solid #313244',
                height: 24, fontSize: 11, color: '#585b70', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ color: '#a6e3a1' }}>⎇ main</span>
                    <span>🗂 {files.length} files</span>
                    {activeFile && tabs.some(t => t.path === activeTab && t.modified) && (
                        <span style={{ color: '#f9e2af' }}>● Modified</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {activeFile && (
                        <>
                            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                            <span>{langLabel}</span>
                            <span>UTF-8</span>
                        </>
                    )}
                    <span style={{ color: '#cba6f7' }}>SylOS IDE</span>
                </div>
            </div>
        </div>
    )
}

export default AgentIDEApp
