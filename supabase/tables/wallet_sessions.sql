CREATE TABLE wallet_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    connection_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    expires_at TIMESTAMP WITH TIME ZONE
);