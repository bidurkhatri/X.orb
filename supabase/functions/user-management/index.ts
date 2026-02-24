// Edge Function: User Management API
// SylOS Blockchain Operating System

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
}

interface UserRequest {
  action: 'register' | 'login' | 'profile' | 'update'
  email?: string
  wallet_address?: string
  username?: string
  full_name?: string
  bio?: string
  avatar_url?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, ...userData }: UserRequest = await req.json()

    switch (action) {
      case 'register':
        // Register new user
        const { data: newUser, error: registerError } = await supabase
          .from('users')
          .insert([{
            email: userData.email,
            wallet_address: userData.wallet_address,
            username: userData.username,
            full_name: userData.full_name,
            bio: userData.bio,
            avatar_url: userData.avatar_url
          }])
          .select()

        if (registerError) {
          return new Response(
            JSON.stringify({ error: registerError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ data: newUser, message: 'User registered successfully' }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'login':
        // User login with wallet or email
        let query = supabase.from('users').select('*')
        
        if (userData.wallet_address) {
          query = query.eq('wallet_address', userData.wallet_address)
        } else if (userData.email) {
          query = query.eq('email', userData.email)
        }

        const { data: loginUser, error: loginError } = await query.single()

        if (loginError || !loginUser) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ data: loginUser }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'profile':
        // Get user profile
        const { data: profileUser, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('wallet_address', userData.wallet_address)
          .single()

        if (profileError || !profileUser) {
          return new Response(
            JSON.stringify({ error: 'Profile not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ data: profileUser }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'update':
        // Update user profile
        const { data: updateUser, error: updateError } = await supabase
          .from('users')
          .update({
            full_name: userData.full_name,
            bio: userData.bio,
            avatar_url: userData.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('wallet_address', userData.wallet_address)
          .select()

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ data: updateUser, message: 'Profile updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
