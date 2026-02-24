CREATE TABLE staking_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_name VARCHAR(100) NOT NULL,
    pool_description TEXT,
    token_symbol VARCHAR(10) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    blockchain_network VARCHAR(20) NOT NULL,
    total_staked DECIMAL(20,8) DEFAULT 0,
    apy DECIMAL(10,4) DEFAULT 0,
    min_stake_amount DECIMAL(20,8) DEFAULT 0,
    max_stake_amount DECIMAL(20,8) DEFAULT 0,
    lock_period_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);