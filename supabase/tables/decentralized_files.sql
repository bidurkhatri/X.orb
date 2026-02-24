CREATE TABLE decentralized_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    ipfs_cid VARCHAR(255) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT false,
    encrypted BOOLEAN DEFAULT true,
    access_level VARCHAR(20) DEFAULT 'private',
    sharing_permissions JSONB,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0
);

-- Row Level Security (RLS) Policies 
ALTER TABLE decentralized_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own files" 
ON decentralized_files FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own files" 
ON decentralized_files FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update access to own files" 
ON decentralized_files FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" 
ON decentralized_files FOR DELETE 
USING (auth.uid() = user_id);