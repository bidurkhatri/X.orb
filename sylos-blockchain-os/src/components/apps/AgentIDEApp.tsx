/**
 * @file AgentIDEApp.tsx
 * @description SylOS Agent IDE — Monaco Editor-powered coding environment
 *
 * Inspired by openclaw-studio (https://github.com/grp06/openclaw-studio)
 * Agents write code via generate_code tool → files appear here.
 * Users can edit, create, delete, and browse agent-authored code.
 *
 * Features:
 * - Monaco Editor (same engine as VS Code)
 * - Virtual filesystem backed by localStorage
 * - File tree sidebar with folders
 * - Multi-tab editing
 * - EventBus integration for agent-generated files
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { eventBus } from '@/services/EventBus'

/* ═══════════════════════════════
   ═══  VIRTUAL FS  ═══════════════
   ═══════════════════════════════ */

const VFS_KEY = 'sylos_vfs'

interface VFile {
    path: string
    content: string
    language: string
    author: string        // 'user' or agent ID
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
            content: `# Welcome to the SylOS IDE 🚀

This is your in-browser coding environment powered by Monaco Editor.

## How it works
- **Agents** can write code here using the \`generate_code\` tool
- **You** can create, edit, and organize files
- All files are saved to localStorage

## Try it out
Create a new file using the + button in the sidebar.
`,
            language: 'markdown',
            author: 'system',
            authorName: 'SylOS',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            path: '/contracts/HelloWorld.sol',
            content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message;

    constructor(string memory _message) {
        message = _message;
    }

    function setMessage(string memory _newMessage) public {
        message = _newMessage;
    }
}
`,
            language: 'sol',
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
        sh: 'shell', bash: 'shell', txt: 'plaintext',
    }
    return map[ext] || 'plaintext'
}

/* ═══════════════════════════════
   ═══  FILE TREE HELPERS  ═══════
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

    // Sort: dirs first, then files
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
            return a.name.localeCompare(b.name)
        })
        for (const n of nodes) {
            if (n.children) sortNodes(n.children)
        }
    }
    sortNodes(root)
    return root
}

/* ═══════════════════════════════
   ═══  ICONS  ═══════════════════
   ═══════════════════════════════ */

function fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const icons: Record<string, string> = {
        ts: '🔷', tsx: '⚛️', js: '🟡', jsx: '⚛️',
        sol: '💎', json: '📋', md: '📝', py: '🐍',
        css: '🎨', html: '🌐', yml: '⚙️', yaml: '⚙️',
    }
    return icons[ext] || '📄'
}

/* ═══════════════════════════════
   ═══  COMPONENT  ═══════════════
   ═══════════════════════════════ */

interface Tab {
    path: string
    modified: boolean
}

const AgentIDEApp: React.FC = () => {
    const [files, setFiles] = useState<VFile[]>(loadVFS)
    const [tabs, setTabs] = useState<Tab[]>([{ path: '/welcome.md', modified: false }])
    const [activeTab, setActiveTab] = useState('/welcome.md')
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/contracts']))
    const [showNewFile, setShowNewFile] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const newFileRef = useRef<HTMLInputElement>(null)

    // Save to localStorage whenever files change
    useEffect(() => { saveVFS(files) }, [files])

    // Focus new file input when shown
    useEffect(() => {
        if (showNewFile && newFileRef.current) newFileRef.current.focus()
    }, [showNewFile])

    // ── EventBus: listen for agent-generated code ──
    useEffect(() => {
        const unsub = eventBus.on('agent:tool_executed', (event) => {
            if (event.payload?.toolName === 'generate_code') {
                const { filename, code, language: lang } = event.payload
                if (!filename || !code) return

                const path = filename.startsWith('/') ? filename : '/' + filename

                setFiles(prev => {
                    const existing = prev.findIndex(f => f.path === path)
                    const newFile: VFile = {
                        path,
                        content: code,
                        language: lang || detectLanguage(filename),
                        author: event.source,
                        authorName: event.sourceName,
                        createdAt: existing >= 0 ? prev[existing]!.createdAt : Date.now(),
                        updatedAt: Date.now(),
                    }

                    if (existing >= 0) {
                        const updated = [...prev]
                        updated[existing] = newFile
                        return updated
                    }
                    return [...prev, newFile]
                })

                // Open the file in a tab
                setTabs(prev => {
                    if (prev.some(t => t.path === path)) return prev
                    return [...prev, { path, modified: false }]
                })
                setActiveTab(path)
            }
        })
        return unsub
    }, [])

    // ── File operations ──
    const getActiveFile = useCallback(() => {
        return files.find(f => f.path === activeTab) || null
    }, [files, activeTab])

    const handleContentChange = useCallback((value: string | undefined) => {
        if (!value) return
        setFiles(prev => prev.map(f =>
            f.path === activeTab ? { ...f, content: value, updatedAt: Date.now() } : f
        ))
        setTabs(prev => prev.map(t =>
            t.path === activeTab ? { ...t, modified: true } : t
        ))
    }, [activeTab])

    const openFile = useCallback((path: string) => {
        if (!tabs.some(t => t.path === path)) {
            setTabs(prev => [...prev, { path, modified: false }])
        }
        setActiveTab(path)
    }, [tabs])

    const closeTab = useCallback((path: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setTabs(prev => {
            const next = prev.filter(t => t.path !== path)
            if (activeTab === path && next.length > 0) {
                setActiveTab(next[next.length - 1]!.path)
            }
            return next
        })
    }, [activeTab])

    const createFile = useCallback(() => {
        if (!newFileName.trim()) return
        const path = newFileName.startsWith('/') ? newFileName : '/' + newFileName
        if (files.some(f => f.path === path)) {
            setShowNewFile(false)
            setNewFileName('')
            openFile(path)
            return
        }

        const newFile: VFile = {
            path,
            content: '',
            language: detectLanguage(path),
            author: 'user',
            authorName: 'You',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
        setFiles(prev => [...prev, newFile])
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
        setExpandedDirs(prev => {
            const next = new Set(prev)
            next.has(path) ? next.delete(path) : next.add(path)
            return next
        })
    }, [])

    // ── TreeNode renderer ──
    const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
        if (node.isDir) {
            const expanded = expandedDirs.has(node.path)
            return (
                <div key={node.path}>
                    <div
                        onClick={() => toggleDir(node.path)}
                        style={{
                            padding: '3px 8px', paddingLeft: 8 + depth * 14,
                            cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                            color: '#d1d5db',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e1e30')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{expanded ? '▼' : '▶'}</span>
                        <span>📁</span>
                        <span>{node.name}</span>
                    </div>
                    {expanded && node.children?.map(c => renderNode(c, depth + 1))}
                </div>
            )
        }

        const isActive = activeTab === node.path
        const authorFile = files.find(f => f.path === node.path)
        const isAgent = authorFile?.author && authorFile.author !== 'user' && authorFile.author !== 'system'

        return (
            <div
                key={node.path}
                onClick={() => openFile(node.path)}
                onContextMenu={(e) => {
                    e.preventDefault()
                    if (confirm(`Delete ${node.name}?`)) deleteFile(node.path)
                }}
                style={{
                    padding: '3px 8px', paddingLeft: 14 + depth * 14,
                    cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                    color: isActive ? '#fff' : '#9ca3af',
                    background: isActive ? '#1e1e30' : 'transparent',
                    borderLeft: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#16162a')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
                <span>{fileIcon(node.name)}</span>
                <span style={{ flex: 1 }}>{node.name}</span>
                {isAgent && <span style={{ fontSize: 9, color: '#8b5cf6' }}>🤖</span>}
            </div>
        )
    }

    const tree = buildTree(files)
    const activeFile = getActiveFile()

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e2e', color: '#cdd6f4', fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#181825', borderBottom: '1px solid #313244', minHeight: 32, overflow: 'auto' }}>
                {tabs.map(tab => {
                    const fname = tab.path.split('/').pop() || tab.path
                    return (
                        <div
                            key={tab.path}
                            onClick={() => setActiveTab(tab.path)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                                background: activeTab === tab.path ? '#1e1e2e' : 'transparent',
                                borderRight: '1px solid #313244',
                                color: activeTab === tab.path ? '#cdd6f4' : '#6c7086',
                                borderBottom: activeTab === tab.path ? '2px solid #cba6f7' : '2px solid transparent',
                            }}
                        >
                            <span>{fileIcon(fname)}</span>
                            <span>{fname}</span>
                            {tab.modified && <span style={{ color: '#f9e2af', fontSize: 10 }}>●</span>}
                            <span
                                onClick={(e) => closeTab(tab.path, e)}
                                style={{ fontSize: 10, opacity: 0.5, padding: '0 2px', marginLeft: 4 }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                            >✕</span>
                        </div>
                    )
                })}
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Sidebar */}
                <div style={{ width: 200, background: '#11111b', borderRight: '1px solid #313244', overflow: 'auto', flexShrink: 0 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #313244' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#a6adc8', textTransform: 'uppercase', letterSpacing: 1 }}>Explorer</span>
                        <span
                            onClick={() => setShowNewFile(true)}
                            style={{ cursor: 'pointer', fontSize: 16, color: '#89b4fa', lineHeight: 1 }}
                            title="New File"
                        >+</span>
                    </div>

                    {/* New file input */}
                    {showNewFile && (
                        <div style={{ padding: '4px 8px' }}>
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
                                    width: '100%', padding: '3px 6px', fontSize: 11, borderRadius: 3,
                                    background: '#1e1e2e', border: '1px solid #89b4fa', color: '#cdd6f4',
                                    outline: 'none',
                                }}
                            />
                        </div>
                    )}

                    {/* File tree */}
                    <div style={{ padding: '4px 0' }}>
                        {tree.map(node => renderNode(node))}
                    </div>
                </div>

                {/* Editor area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {activeFile ? (
                        <>
                            {/* File info bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 12px', background: '#181825', borderBottom: '1px solid #313244', fontSize: 11 }}>
                                <span style={{ color: '#6c7086' }}>{activeFile.path}</span>
                                <span style={{ color: '#585b70' }}>
                                    {activeFile.author === 'user' ? '👤 You' : activeFile.author === 'system' ? '🖥️ System' : `🤖 ${activeFile.authorName}`}
                                    {' · '}
                                    {new Date(activeFile.updatedAt).toLocaleTimeString()}
                                </span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <Editor
                                    theme="vs-dark"
                                    language={activeFile.language}
                                    value={activeFile.content}
                                    onChange={handleContentChange}
                                    options={{
                                        fontSize: 13,
                                        fontFamily: 'JetBrains Mono, Consolas, monospace',
                                        minimap: { enabled: false },
                                        scrollBeyondLastLine: false,
                                        renderLineHighlight: 'all',
                                        padding: { top: 8 },
                                        automaticLayout: true,
                                        wordWrap: activeFile.language === 'markdown' ? 'on' : 'off',
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#585b70' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>💻</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>No file open</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>Select a file from the explorer or create a new one</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 12px', background: '#181825', borderTop: '1px solid #313244', fontSize: 11, color: '#585b70' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <span>🗂️ {files.length} files</span>
                    {activeFile && <span>{activeFile.language.toUpperCase()}</span>}
                </div>
                <span>SylOS IDE v1.0</span>
            </div>
        </div>
    )
}

export default AgentIDEApp
