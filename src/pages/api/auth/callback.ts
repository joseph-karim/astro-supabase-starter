import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  
  if (!code) {
    return redirect('/login?error=missing_code')
  }

  const supabaseUrl = import.meta.env.SUPABASE_DATABASE_URL
  const supabaseKey = import.meta.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return redirect('/login?error=config_error')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  
  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.session) {
    // Set auth cookies
    cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    
    cookies.set('sb-refresh-token', data.session.refresh_token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
  }

  return redirect('/dashboard')
}

