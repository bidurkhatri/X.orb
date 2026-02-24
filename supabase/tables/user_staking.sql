CREATE TABLE user_staking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    pool_id UUID NOT NULL,
    staked_amount DECIMAL(20,8) NOT NULL,
    current_rewards DECIMAL(20,8) DEFAULT 0,
    claimed_rewards DECIMAL(20,8) DEFAULT 0,
    staking_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unlock_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB
);