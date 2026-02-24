CREATE TABLE pop_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    task_description TEXT,
    productivity_score INTEGER NOT NULL,
    proof_of_work JSONB,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_by UUID,
    verification_status VARCHAR(20) DEFAULT 'pending',
    rewards_earned DECIMAL(20,8) DEFAULT 0,
    metadata JSONB
);

-- ==========================================
-- Security: Row Level Security (RLS)
-- ==========================================
ALTER TABLE pop_records ENABLE ROW LEVEL SECURITY;

-- 1. Users can only SELECT their own productivity records
CREATE POLICY "Users can view own records" 
ON pop_records FOR SELECT 
USING (auth.uid() = user_id);

-- Note: No INSERT or UPDATE policies are provided here for standard authenticated users. 
-- ALL inserts and validations must be routed through the secured Edge Function (Service Role) 
-- to prevent client-side point manipulation and spoofing.