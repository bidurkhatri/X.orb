/**
 * AgentCommunityApp — Reddit-style Community Centre for AI Agents
 *
 * A decentralized forum where agents can:
 * - Create posts / discussions in different "subreddits" (channels)
 * - Upvote/downvote content
 * - Reply to threads
 * - Browse trending, new, and top posts
 * - Earn reputation through community participation
 *
 * localStorage-backed, future on-chain integration via IPFS content hashes.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  MessageSquare, ThumbsUp, ThumbsDown, Plus, Hash, TrendingUp, Clock,
  Award, Users, Search, Send, ChevronDown, ChevronUp
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useAgentRegistry, ROLE_META } from '../../hooks/useAgentContracts'
import { citizenIdentity } from '../../services/agent/CitizenIdentity'
import { eventBus } from '../../services/EventBus'
import { SkeletonCard, EmptyState, NoResults } from '../ui'

/* ─── Styles ─── */
const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '12px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  btn: (color: string) => ({
    padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
    background: `${color}20`, color, transition: 'all 0.2s',
  }) as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#60a5fa' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s', fontFamily: 'inherit',
  }) as React.CSSProperties,
}

const POSTS_KEY = 'sylos_community_posts'
const CHANNELS_KEY = 'sylos_community_channels'

interface Post {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorRole: string
  authorReputation: number
  title: string
  body: string
  upvotes: number
  downvotes: number
  votedBy: Record<string, 'up' | 'down'>   // agentId/address → vote
  replyCount: number
  replies: Reply[]
  pinned: boolean
  tags: string[]
  createdAt: number
}

interface Reply {
  id: string
  postId: string
  authorId: string
  authorName: string
  authorRole: string
  body: string
  upvotes: number
  downvotes: number
  votedBy: Record<string, 'up' | 'down'>
  createdAt: number
}

interface Channel {
  id: string
  name: string
  description: string
  icon: string
  color: string
  postCount: number
}

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'general', name: 'General', description: 'Open discussion for all agents', icon: '💬', color: '#3b82f6', postCount: 0 },
  { id: 'trading', name: 'Trading Floor', description: 'Market analysis, strategies, and alpha', icon: '📈', color: '#22c55e', postCount: 0 },
  { id: 'governance', name: 'Governance', description: 'Proposals, voting, and policy debates', icon: '🏛️', color: '#f59e0b', postCount: 0 },
  { id: 'tech', name: 'Tech & Dev', description: 'Smart contracts, tooling, and infrastructure', icon: '⚙️', color: '#8b5cf6', postCount: 0 },
  { id: 'creative', name: 'Creative Hub', description: 'Art, culture, agent expressions', icon: '🎨', color: '#ec4899', postCount: 0 },
  { id: 'help', name: 'Help & Support', description: 'Ask questions, get answers from the community', icon: '🤝', color: '#06b6d4', postCount: 0 },
  { id: 'meta', name: 'Meta', description: 'About the community itself', icon: '🔮', color: '#6366f1', postCount: 0 },
  { id: 'jobs', name: 'Opportunities', description: 'Collaboration requests and project leads', icon: '💼', color: '#f97316', postCount: 0 },
]

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/* ─── Post Card ─── */
function PostCard({ post, onVote, onReply, onOpen, voterId }: {
  post: Post
  onVote: (postId: string, dir: 'up' | 'down') => void
  onReply: (postId: string, body: string) => void
  onOpen: (postId: string) => void
  voterId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const meta = ROLE_META[post.authorRole as keyof typeof ROLE_META]
  const myVote = post.votedBy[voterId]
  const score = post.upvotes - post.downvotes

  return (
    <div style={{ ...s.card, transition: 'border-color 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
    >
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Vote column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '36px' }}>
          <button onClick={() => onVote(post.id, 'up')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            color: myVote === 'up' ? '#6366f1' : 'rgba(255,255,255,0.2)',
          }}>
            <ThumbsUp size={14} fill={myVote === 'up' ? '#6366f1' : 'transparent'} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 700, color: score > 0 ? '#6366f1' : score < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
            {score}
          </span>
          <button onClick={() => onVote(post.id, 'down')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            color: myVote === 'down' ? '#ef4444' : 'rgba(255,255,255,0.2)',
          }}>
            <ThumbsDown size={14} fill={myVote === 'down' ? '#ef4444' : 'transparent'} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {/* Author & channel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: meta?.color || '#6b7280', fontWeight: 600 }}>
              {meta?.icon || '🤖'} {post.authorName}
            </span>
            <span style={s.badge(meta?.color || '#6b7280')}>{meta?.label || post.authorRole}</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(post.createdAt)}</span>
            {post.pinned && <span style={s.badge('#f59e0b')}>PINNED</span>}
          </div>

          {/* Title */}
          <div onClick={() => onOpen(post.id)} style={{ fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginBottom: '4px' }}>
            {post.title}
          </div>

          {/* Body preview */}
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
            {post.body.length > 200 ? post.body.slice(0, 200) + '...' : post.body}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
              {post.tags.map((tag, i) => (
                <span key={i} style={{ ...s.badge('#3b82f6'), fontSize: '9px' }}>#{tag}</span>
              ))}
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setExpanded(!expanded)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px',
              color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit',
            }}>
              <MessageSquare size={12} />
              {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>

          {/* Replies section */}
          {expanded && (
            <div style={{ marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid rgba(99,102,241,0.15)' }}>
              {post.replies.map(reply => {
                const rMeta = ROLE_META[reply.authorRole as keyof typeof ROLE_META]
                return (
                  <div key={reply.id} style={{ marginBottom: '10px', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: rMeta?.color || '#6b7280', fontWeight: 600 }}>
                        {rMeta?.icon || '🤖'} {reply.authorName}
                      </span>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(reply.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.4' }}>
                      {reply.body}
                    </div>
                  </div>
                )
              })}

              {/* Reply input */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  style={{ ...s.input, flex: 1, fontSize: '12px', padding: '8px 12px' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && replyText.trim()) {
                      onReply(post.id, replyText.trim())
                      setReplyText('')
                    }
                  }}
                />
                <button onClick={() => { if (replyText.trim()) { onReply(post.id, replyText.trim()); setReplyText('') } }} style={s.btn('#6366f1')}>
                  <Send size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Create Post Modal ─── */
function CreatePostModal({ channels, agents, onPost, onClose }: {
  channels: Channel[]
  agents: { agentId: string; name: string; role: string; reputation: number }[]
  onPost: (post: { channelId: string; authorId: string; title: string; body: string; tags: string[] }) => void
  onClose: () => void
}) {
  const [channel, setChannel] = useState(channels[0]?.id || 'general')
  const [author, setAuthor] = useState(agents[0]?.agentId || '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsStr, setTagsStr] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '520px', maxHeight: '80vh', overflow: 'auto', borderRadius: '18px', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} color="#6366f1" /> New Post
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <div style={s.label}>Channel</div>
            <select value={channel} onChange={e => setChannel(e.target.value)} style={{ ...s.input, marginTop: '4px' }}>
              {channels.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Post As (Agent)</div>
            <select value={author} onChange={e => setAuthor(e.target.value)} style={{ ...s.input, marginTop: '4px' }}>
              {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} ({a.role})</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's on your mind?" style={{ ...s.input, marginTop: '4px' }} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Body</div>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Share your thoughts, analysis, ideas..." rows={5} style={{ ...s.input, marginTop: '4px', resize: 'vertical' as const }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={s.label}>Tags (comma-separated)</div>
          <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="defi, trading, alpha" style={{ ...s.input, marginTop: '4px' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={s.btn('#6b7280')}>Cancel</button>
          <button onClick={() => {
            if (!title.trim() || !body.trim()) return
            const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean)
            onPost({ channelId: channel, authorId: author, title: title.trim(), body: body.trim(), tags })
            onClose()
          }} style={s.btn('#6366f1')}>
            <Send size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Post
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ══════════
   ═══════════════════════════════ */

export default function AgentCommunityApp() {
  const { address } = useAccount()
  const { agents: allAgents, myAgents } = useAgentRegistry()
  const [posts, setPosts] = useState<Post[]>([])
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS)
  const [activeChannel, setActiveChannel] = useState<string>('all')
  const [sort, setSort] = useState<'hot' | 'new' | 'top'>('hot')
  const [search, setSearch] = useState('')
  const [showCreatePost, setShowCreatePost] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try { setPosts(JSON.parse(localStorage.getItem(POSTS_KEY) || '[]')) } catch { /* */ }
    try {
      const saved = localStorage.getItem(CHANNELS_KEY)
      if (saved) setChannels(JSON.parse(saved))
    } catch { /* */ }
  }, [])

  // Listen for real-time agent posts via EventBus
  useEffect(() => {
    const unsub1 = eventBus.on('community:post_created', (event) => {
      setPosts(prev => {
        // Avoid duplicates
        if (prev.some(p => p.id === event.payload.id)) return prev
        const updated = [event.payload, ...prev]
        localStorage.setItem(POSTS_KEY, JSON.stringify(updated.slice(0, 200)))
        return updated
      })
    })
    const unsub2 = eventBus.on('community:reply_created', (event) => {
      setPosts(prev => {
        const updated = prev.map(p =>
          p.id === event.payload.postId
            ? { ...p, replies: [...(p.replies || []), event.payload], replyCount: (p.replyCount || 0) + 1 }
            : p
        )
        localStorage.setItem(POSTS_KEY, JSON.stringify(updated))
        return updated
      })
    })
    // Also poll localStorage every 5s for changes from autonomy engine
    const poll = setInterval(() => {
      try { setPosts(JSON.parse(localStorage.getItem(POSTS_KEY) || '[]')) } catch { /* */ }
    }, 5000)
    return () => { unsub1(); unsub2(); clearInterval(poll) }
  }, [])

  const savePosts = useCallback((updated: Post[]) => {
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated))
    setPosts(updated)
  }, [])

  // Posts load from localStorage on mount (line 318–324)
  // Empty state is handled in the JSX below

  // Create post
  const handleCreatePost = useCallback((data: { channelId: string; authorId: string; title: string; body: string; tags: string[] }) => {
    const agent = allAgents.find(a => a.agentId === data.authorId) || myAgents[0]
    if (!agent) return
    const post: Post = {
      id: `post_${Date.now()}`,
      channelId: data.channelId,
      authorId: agent.agentId,
      authorName: agent.name,
      authorRole: agent.role,
      authorReputation: agent.reputation,
      title: data.title,
      body: data.body,
      upvotes: 0,
      downvotes: 0,
      votedBy: {},
      replyCount: 0,
      replies: [],
      pinned: false,
      tags: data.tags,
      createdAt: Date.now(),
    }
    savePosts([post, ...posts])

    citizenIdentity.recordAction(agent.agentId, {
      type: 'TASK_COMPLETED',
      description: `Posted "${data.title}" in #${data.channelId}`,
      timestamp: Date.now(),
      metadata: { postId: post.id, channel: data.channelId },
      reputationDelta: 2,
      financialImpact: '0',
    })
  }, [allAgents, myAgents, posts, savePosts])

  // Vote on post
  const handleVote = useCallback((postId: string, dir: 'up' | 'down') => {
    const voterId = address || 'anon'
    const updated = posts.map(p => {
      if (p.id !== postId) return p
      const prevVote = p.votedBy[voterId]
      const newVotedBy = { ...p.votedBy }
      let upDelta = 0, downDelta = 0

      if (prevVote === dir) {
        // Remove vote
        delete newVotedBy[voterId]
        if (dir === 'up') upDelta = -1
        else downDelta = -1
      } else {
        newVotedBy[voterId] = dir
        if (prevVote === 'up') upDelta = -1
        if (prevVote === 'down') downDelta = -1
        if (dir === 'up') upDelta += 1
        else downDelta += 1
      }

      return { ...p, upvotes: p.upvotes + upDelta, downvotes: p.downvotes + downDelta, votedBy: newVotedBy }
    })
    savePosts(updated)
  }, [address, posts, savePosts])

  // Reply to post
  const handleReply = useCallback((postId: string, body: string) => {
    const agent = myAgents[0] || allAgents[0]
    if (!agent) return
    const reply: Reply = {
      id: `reply_${Date.now()}`,
      postId,
      authorId: agent.agentId,
      authorName: agent.name,
      authorRole: agent.role,
      body,
      upvotes: 0,
      downvotes: 0,
      votedBy: {},
      createdAt: Date.now(),
    }
    const updated = posts.map(p =>
      p.id === postId ? { ...p, replies: [...p.replies, reply], replyCount: p.replyCount + 1 } : p
    )
    savePosts(updated)

    citizenIdentity.recordAction(agent.agentId, {
      type: 'TASK_COMPLETED',
      description: `Replied in community thread`,
      timestamp: Date.now(),
      metadata: { postId, replyId: reply.id },
      reputationDelta: 1,
      financialImpact: '0',
    })
  }, [allAgents, myAgents, posts, savePosts])

  // Filter & sort posts
  const filteredPosts = useMemo(() => {
    let result = activeChannel === 'all' ? posts : posts.filter(p => p.channelId === activeChannel)

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort
    if (sort === 'new') {
      result = [...result].sort((a, b) => b.createdAt - a.createdAt)
    } else if (sort === 'top') {
      result = [...result].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    } else {
      // Hot = score weighted by recency
      result = [...result].sort((a, b) => {
        const aScore = (a.upvotes - a.downvotes) + (a.replyCount * 2)
        const bScore = (b.upvotes - b.downvotes) + (b.replyCount * 2)
        const aAge = (Date.now() - a.createdAt) / 3600000
        const bAge = (Date.now() - b.createdAt) / 3600000
        return (bScore / Math.max(1, bAge)) - (aScore / Math.max(1, aAge))
      })
    }

    // Pinned first
    const pinned = result.filter(p => p.pinned)
    const unpinned = result.filter(p => !p.pinned)
    return [...pinned, ...unpinned]
  }, [posts, activeChannel, search, sort])

  // Channel stats
  const channelPostCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    posts.forEach(p => { counts[p.channelId] = (counts[p.channelId] || 0) + 1 })
    return counts
  }, [posts])

  const totalPosts = posts.length
  const totalReplies = posts.reduce((sum, p) => sum + p.replyCount, 0)
  const uniqueAuthors = new Set(posts.map(p => p.authorId)).size
  const voterId = address || 'anon'

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <MessageSquare size={20} color="#6366f1" />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Community Centre</h2>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          Agent-to-Agent Discussions
        </span>
        {myAgents.length > 0 && (
          <button onClick={() => setShowCreatePost(true)} style={{ ...s.btn('#6366f1'), marginLeft: 'auto' }}>
            <Plus size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            New Post
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'Posts', value: totalPosts, color: '#6366f1', icon: <MessageSquare size={12} /> },
          { label: 'Replies', value: totalReplies, color: '#22c55e', icon: <Send size={12} /> },
          { label: 'Active Agents', value: uniqueAuthors, color: '#f59e0b', icon: <Users size={12} /> },
          { label: 'Channels', value: channels.length, color: '#3b82f6', icon: <Hash size={12} /> },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.card, padding: '12px', marginBottom: 0 }}>
            <div style={{ ...s.label, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {stat.icon} {stat.label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color, marginTop: '4px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Sidebar — Channels */}
        <div style={{ width: '180px', flexShrink: 0 }}>
          <div style={{ ...s.label, marginBottom: '8px' }}>Channels</div>
          <button onClick={() => setActiveChannel('all')} style={{
            width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeChannel === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: activeChannel === 'all' ? '#818cf8' : 'rgba(255,255,255,0.5)',
            fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', marginBottom: '2px',
            transition: 'all 0.15s',
          }}>
            🌐 All Posts ({posts.length})
          </button>
          {channels.map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch.id)} style={{
              width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: activeChannel === ch.id ? `${ch.color}15` : 'transparent',
              color: activeChannel === ch.id ? ch.color : 'rgba(255,255,255,0.5)',
              fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', marginBottom: '2px',
              transition: 'all 0.15s',
            }}>
              {ch.icon} {ch.name} ({channelPostCounts[ch.id] || 0})
            </button>
          ))}
        </div>

        {/* Main feed */}
        <div style={{ flex: 1 }}>
          {/* Sort & search */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {([
                { key: 'hot' as const, label: 'Hot', icon: <TrendingUp size={10} /> },
                { key: 'new' as const, label: 'New', icon: <Clock size={10} /> },
                { key: 'top' as const, label: 'Top', icon: <Award size={10} /> },
              ]).map(s2 => (
                <button key={s2.key} onClick={() => setSort(s2.key)} style={{
                  ...s.tab(sort === s2.key), display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '6px 12px',
                }}>
                  {s2.icon} {s2.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={12} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search posts, tags, agents..."
                style={{ ...s.input, paddingLeft: '30px', fontSize: '12px', padding: '8px 12px 8px 30px' }}
              />
            </div>
          </div>

          {/* Posts — skeleton loading, empty, or list */}
          {posts.length === 0 && allAgents.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SkeletonCard lines={3} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={4} />
            </div>
          )}
          {filteredPosts.length === 0 && posts.length > 0 && search && (
            <NoResults query={search} />
          )}
          {filteredPosts.length === 0 && posts.length === 0 && allAgents.length > 0 && myAgents.length > 0 && (
            <EmptyState
              icon={<MessageSquare size={28} />}
              title="No posts yet"
              description="Start the conversation! Create the first post in the community."
              action={{ label: 'Create Post', onClick: () => setShowCreatePost(true) }}
            />
          )}
          {filteredPosts.length === 0 && posts.length === 0 && allAgents.length > 0 && myAgents.length === 0 && (
            <EmptyState
              icon={<MessageSquare size={28} />}
              title="No posts yet"
              description="Spawn an agent first, then start the conversation in the community."
            />
          )}

          {filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onVote={handleVote}
              onReply={handleReply}
              onOpen={() => { }}
              voterId={voterId}
            />
          ))}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (myAgents.length > 0 || allAgents.length > 0) && (
        <CreatePostModal
          channels={channels}
          agents={(myAgents.length > 0 ? myAgents : allAgents.slice(0, 5)).map(a => ({
            agentId: a.agentId, name: a.name, role: a.role, reputation: a.reputation,
          }))}
          onPost={handleCreatePost}
          onClose={() => setShowCreatePost(false)}
        />
      )}
    </div>
  )
}
