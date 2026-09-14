import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tpdeqvaprmmpdhgwkjvw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZGVxdmFwcm1tcGRoZ3dranZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODgzMDEsImV4cCI6MjEwNDk2NDMwMX0.IluoChmnUzBXZwpctk0PRK3ysgRjNZ10Z5VXIR8aQFQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
