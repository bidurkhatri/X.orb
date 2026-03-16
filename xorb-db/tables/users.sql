CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(42) UNIQUE,
    username VARCHAR(50) UNIQUE,
    full_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT false,
    productivity_score INTEGER DEFAULT 0,
    total_staked_tokens DECIMAL(20,8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Security: Row Level Security (RLS)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. Users can only SELECT their own full profile data
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- 2. Users can only UPDATE their own profile data
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- ==========================================
-- Views: Public Profiles
-- ==========================================
-- Creates a secure view for the Leaderboard and App, stripping sensitive info like email and wallet_address.
CREATE VIEW public_user_profiles AS
SELECT 
    id, 
    username, 
    avatar_url, 
    bio, 
    productivity_score, 
    total_staked_tokens, 
    is_verified,
    created_at
FROM users;

-- Grant read access to the public view
GRANT SELECT ON public_user_profiles TO authenticated, anon;