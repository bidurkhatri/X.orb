CREATE TABLE nft_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    creator_id UUID NOT NULL,
    collection_address VARCHAR(42),
    token_metadata JSONB,
    price DECIMAL(20,8),
    is_for_sale BOOLEAN DEFAULT false,
    blockchain_network VARCHAR(20) NOT NULL,
    ipfs_cid VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);