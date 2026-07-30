import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Middleware: Variables de entorno de Supabase faltantes en Edge Runtime.');
      return NextResponse.next(); // Bypass si no hay variables (evita Error 500 en build/edge)
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')
    
    if (
      !user &&
      !isAuthRoute &&
      request.nextUrl.pathname !== '/' &&
      !request.nextUrl.pathname.startsWith('/api/') &&
      !request.nextUrl.pathname.startsWith('/auth/')
    ) {
      // Redirigir usuarios no autenticados al login, excepto api o auth
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (user && isAuthRoute) {
      // Redirigir usuarios autenticados al dashboard
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/workspaces'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error);
    // En caso de fallo crítico en Edge (ej. supabase caído o red), dejar pasar la request.
    return NextResponse.next();
  }
}
