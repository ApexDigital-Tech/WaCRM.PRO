'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  try {
    const supabase = createClient()

    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
      return { error: error.message }
    }
  } catch (error: any) {
    console.error("Action error:", error);
    return { error: error?.message || 'Error del servidor al iniciar sesión' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard/workspaces')
}

export async function signup(formData: FormData) {
  try {
    const supabase = createClient()

    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      options: {
        data: {
          full_name: formData.get('full_name') as string,
        }
      }
    }

    const { error } = await supabase.auth.signUp(data)

    if (error) {
      return { error: error.message }
    }
  } catch (error: any) {
    console.error("Action error:", error);
    return { error: error?.message || 'Error del servidor al registrar usuario' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard/workspaces')
}
