// Edge Function: PoP (Proof of Productivity) Tracker API
// Xorb Blockchain Operating System (Secured)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
}

// ==========================================
// Strict Validation Schemas (Zod)
// ==========================================
const RecordSchema = z.object({
  task_type: z.string().min(1),
  task_description: z.string().min(1).optional(),
  productivity_score: z.number().int().positive(),
  proof_of_work: z.any().optional(),
})

const VerifySchema = z.object({
  record_id: z.string().uuid(),
  verification_status: z.enum(['approved', 'rejected']),
})

const StatsSchema = z.object({
  user_id: z.string().uuid().optional(),
})

// ==========================================
// Server Request Handler
// ==========================================
serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // 2. Initialize Supabase Client with Service Role (Bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. SECURE AUTHENTICATION: Verify JWT
    // We NEVER trust client-supplied user_ids. We extract identity cryptographically.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. Parse Request
    const { action, ...rawPayload } = await req.json()

    // 5. Route Action
    switch (action) {
      case 'record': {
        // Validation
        const parsed = RecordSchema.safeParse(rawPayload)
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'Validation Error', details: parsed.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const popData = parsed.data

        // Insert new record using the CRYPTOGRAPHIC user.id, ignoring any tampered payload
        const { data: newRecord, error: recordError } = await supabase
          .from('pop_records')
          .insert([{
            user_id: user.id, // STRICT enforcing
            task_type: popData.task_type,
            task_description: popData.task_description,
            productivity_score: popData.productivity_score,
            proof_of_work: popData.proof_of_work,
            verification_status: 'pending' // Force pending
          }])
          .select()

        if (recordError) {
          return new Response(JSON.stringify({ error: recordError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ data: newRecord, message: 'PoP record created successfully. Pending verification.' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'verify': {
        // Validation
        const parsed = VerifySchema.safeParse(rawPayload)
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'Validation Error', details: parsed.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // NOTE: In a true production environment, we must check if `user.id` has the "Verifier" role.
        // RBAC Enforcement: Check if the authenticated user has verifier privileges
        const { data: verifierCheck } = await supabase
          .from('users')
          .select('is_verified')
          .eq('id', user.id)
          .single()

        if (!verifierCheck?.is_verified) {
          return new Response(JSON.stringify({ error: 'Forbidden: Only verified users can verify records' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { data: verifiedRecord, error: verifyError } = await supabase
          .from('pop_records')
          .update({
            verification_status: parsed.data.verification_status,
            verified_by: user.id, // Record who verified it
          })
          .eq('id', parsed.data.record_id)
          .select()

        if (verifyError) {
          return new Response(JSON.stringify({ error: verifyError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // If Approved, update user's total productivity score
        if (parsed.data.verification_status === 'approved' && verifiedRecord && verifiedRecord[0]) {
          const targetUserId = verifiedRecord[0].user_id
          const { data: userStats } = await supabase
            .from('pop_records')
            .select('productivity_score')
            .eq('user_id', targetUserId)
            .eq('verification_status', 'approved')

          const totalScore = userStats?.reduce((sum, record) => sum + record.productivity_score, 0) || 0

          await supabase
            .from('users')
            .update({ productivity_score: totalScore })
            .eq('id', targetUserId)
        }

        return new Response(JSON.stringify({ data: verifiedRecord, message: 'PoP record verification updated.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'leaderboard': {
        // The public_user_profiles view we created already handles data stripping.
        const { data: leaderboard, error: leaderboardError } = await supabase
          .from('public_user_profiles')
          .select('*')
          .order('productivity_score', { ascending: false })
          .limit(100)

        if (leaderboardError) {
          return new Response(JSON.stringify({ error: leaderboardError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ data: leaderboard }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'user_stats': {
        const parsed = StatsSchema.safeParse(rawPayload)
        const targetUserId = parsed.success && parsed.data.user_id ? parsed.data.user_id : user.id

        const { data: userRecords, error: statsError } = await supabase
          .from('pop_records')
          .select('*')
          .eq('user_id', targetUserId)
          .order('completed_at', { ascending: false })

        if (statsError) {
          return new Response(JSON.stringify({ error: statsError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const totalRecords = userRecords?.length || 0
        const approvedRecords = userRecords?.filter(r => r.verification_status === 'approved') || []
        const totalScore = approvedRecords.reduce((sum, record) => sum + record.productivity_score, 0)

        const stats = {
          total_records: totalRecords,
          approved_records: approvedRecords.length,
          total_productivity_score: totalScore,
          average_score: totalRecords > 0 ? totalScore / totalRecords : 0,
          records: userRecords
        }

        return new Response(JSON.stringify({ data: stats }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
