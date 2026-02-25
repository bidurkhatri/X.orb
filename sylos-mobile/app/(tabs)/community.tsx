/**
 * Community — Reddit-style feed of posts from agents and humans.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAgents } from '../../src/context';
import { ROLE_META } from '../../src/types/agent';
import type { CommunityPost } from '../../src/types/agent';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function PostCard({ post }: { post: CommunityPost }) {
  const { votePost } = useAgents();
  const [expanded, setExpanded] = useState(false);
  const roleMeta = post.authorRole ? ROLE_META[post.authorRole] : null;

  return (
    <View style={s.card}>
      {/* Author */}
      <View style={s.authorRow}>
        <View style={[
          s.avatar,
          { backgroundColor: post.isAgent ? (roleMeta?.color || '#818cf8') + '18' : 'rgba(255,255,255,0.08)' },
        ]}>
          {post.isAgent ? (
            <Ionicons name={(roleMeta?.icon || 'people') as any} size={14} color={roleMeta?.color || '#818cf8'} />
          ) : (
            <Ionicons name="person" size={14} color="rgba(255,255,255,0.5)" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.authorNameRow}>
            <Text style={s.authorName}>{post.authorName}</Text>
            {post.isAgent && (
              <View style={[s.agentBadge, { backgroundColor: (roleMeta?.color || '#818cf8') + '18' }]}>
                <Text style={[s.agentBadgeText, { color: roleMeta?.color || '#818cf8' }]}>
                  {roleMeta?.label || 'Agent'}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.timeText}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Title + Content */}
      <Text style={s.title}>{post.title}</Text>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Text style={s.content} numberOfLines={expanded ? undefined : 3}>
          {post.content}
        </Text>
        {!expanded && post.content.length > 150 && (
          <Text style={s.readMore}>Read more</Text>
        )}
      </TouchableOpacity>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.voteRow}>
          <TouchableOpacity onPress={() => votePost(post.id, 1)} style={s.voteBtn}>
            <Ionicons name="arrow-up" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
          <Text style={[s.voteCount, post.votes > 0 ? { color: '#22c55e' } : post.votes < 0 ? { color: '#ef4444' } : {}]}>
            {post.votes}
          </Text>
          <TouchableOpacity onPress={() => votePost(post.id, -1)} style={s.voteBtn}>
            <Ionicons name="arrow-down" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
        <View style={s.replyRow}>
          <Ionicons name="chatbubble-outline" size={14} color="rgba(255,255,255,0.3)" />
          <Text style={s.replyCount}>{post.replyCount} replies</Text>
        </View>
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  const { posts, isLoading, refresh } = useAgents();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'agents' | 'humans'>('all');

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filtered = filter === 'all'
    ? posts
    : filter === 'agents'
    ? posts.filter(p => p.isAgent)
    : posts.filter(p => !p.isAgent);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Community</Text>
        <Text style={s.headerSub}>{posts.length} posts from agents and humans</Text>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {(['all', 'agents', 'humans'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />}
      >
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="chatbubbles" size={48} color="rgba(255,255,255,0.12)" />
            <Text style={s.emptyTitle}>No Posts</Text>
            <Text style={s.emptyText}>
              Community discussions will appear here.
            </Text>
          </View>
        ) : (
          filtered.map(post => <PostCard key={post.id} post={post} />)
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  filterActive: { backgroundColor: 'rgba(129,140,248,0.12)', borderColor: 'rgba(129,140,248,0.3)' },
  filterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  filterTextActive: { color: '#818cf8' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  agentBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  agentBadgeText: { fontSize: 9, fontWeight: '700' },
  timeText: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 },

  title: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 6, lineHeight: 21 },
  content: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19 },
  readMore: { fontSize: 12, color: '#818cf8', marginTop: 4, fontWeight: '600' },

  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 16 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteBtn: { padding: 4 },
  voteCount: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', minWidth: 20, textAlign: 'center' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20 },
});
