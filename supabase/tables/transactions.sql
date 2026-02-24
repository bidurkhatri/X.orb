CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    contract_address VARCHAR(42),
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(20,8),
    token_symbol VARCHAR(10),
    blockchain_network VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    block_number BIGINT,
    gas_used BIGINT,
    gas_price DECIMAL(20,8),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);