import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch the user's profile from the profiles table
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data)
    return data
  }

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Sign up with email, password, username, and invite code
  async function signUp(email, password, username, inviteCode) {
    // 1. Check if username is already taken
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .single()

    if (existingUser) {
      return { error: { message: 'That username is already taken.' } }
    }

    // 2. Validate the invite code (supports multi-use, expiry, and deactivation)
    const { data: codes, error: codeError } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', inviteCode.toUpperCase())
      .eq('is_active', true)

    if (codeError || !codes || codes.length === 0) {
      return { error: { message: 'Invalid or expired invite code.' } }
    }

    const codeData = codes[0]

    // Check expiry (null expires_at = never expires)
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return { error: { message: 'This invite code has expired.' } }
    }

    // Check usage cap (null max_uses = unlimited)
    if (codeData.max_uses !== null && codeData.use_count >= codeData.max_uses) {
      return { error: { message: 'This invite code has reached its maximum uses.' } }
    }

    // 3. Create the auth user with username in metadata
    //    A database trigger (handle_new_user) auto-creates the profile row
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
      },
    })

    if (authError) return { error: authError }

    // 4. Increment the use count and record the usage
    await supabase
      .from('invite_codes')
      .update({ use_count: (codeData.use_count || 0) + 1 })
      .eq('id', codeData.id)

    await supabase
      .from('invite_code_uses')
      .insert({
        invite_code_id: codeData.id,
        used_by: authData.user.id,
      })

    return { data: authData, error: null }
  }

  // Sign in with email and password
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setSession(null)
      setProfile(null)
    }
    return { error }
  }

  const value = {
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin: profile?.is_admin || false,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
