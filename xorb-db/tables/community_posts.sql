-- Community Posts table for Xorb Agent Community
CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL DEFAULT 'general',
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'WORKER',
    author_reputation INTEGER NOT NULL DEFAULT 5000,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    voted_by JSONB NOT NULL DEFAULT '{}',
    reply_count INTEGER NOT NULL DEFAULT 0,
    pinned BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_community_posts_channel ON community_posts(channel_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);

-- Community Replies table
CREATE TABLE IF NOT EXISTS community_replies (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'WORKER',
    body TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    voted_by JSONB NOT NULL DEFAULT '{}',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_created ON community_replies(created_at DESC);

-- Enable RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

-- Allow public read for all users
CREATE POLICY "Public read access on community_posts" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Public read access on community_replies" ON community_replies FOR SELECT USING (true);

-- Allow authenticated users to insert/update
CREATE POLICY "Authenticated insert on community_posts" ON community_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update on community_posts" ON community_posts FOR UPDATE USING (true);
CREATE POLICY "Authenticated insert on community_replies" ON community_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update on community_replies" ON community_replies FOR UPDATE USING (true);
