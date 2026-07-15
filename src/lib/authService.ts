import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface AuthResult {
  data: { user: User | null; session: Session | null } | null
  error: string | null
}

function toFriendlyMessage(error: AuthError | null): string | null {
  if (!error) return null

  console.error('Supabase auth error:', error)

  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (message.includes('email not confirmed')) {
    return 'Please verify your email address before logging in.'
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account with this email already exists.'
  }
  if (message.includes('password should be at least') || message.includes('weak password')) {
    return 'Please choose a stronger password (at least 8 characters).'
  }
  if (message.includes('invalid email')) {
    return 'Please enter a valid email address.'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Network error. Please check your connection and try again.'
  }
  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  return 'Something went wrong. Please try again.'
}

export async function signUp(fullName: string, email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
    },
  })

  return { data, error: toFriendlyMessage(error) }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  return { data, error: toFriendlyMessage(error) }
}

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut()
  return { error: toFriendlyMessage(error) }
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  return { error: toFriendlyMessage(error) }
}

export async function resendVerificationEmail(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: {
      emailRedirectTo: `${window.location.origin}/customer/profile-settings`,
    },
  })

  return { error: toFriendlyMessage(error) }
}

export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error: toFriendlyMessage(error) }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Failed to get current user:', error)
    return null
  }
  return data.user
}
