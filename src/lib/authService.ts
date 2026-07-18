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
  if (!error) {
    return { error: null }
  }

  const message = error.message.toLowerCase()

  if (
    message.includes('auth session missing') ||
    message.includes('session') ||
    message.includes('reauthentication') ||
    message.includes('re-authentication') ||
    message.includes('recent login') ||
    message.includes('log in again')
  ) {
    return { error: 'For security, please log out and log in again before changing your password.' }
  }

  if (message.includes('password should be at least') || message.includes('weak password')) {
    return { error: 'Please choose a stronger password.' }
  }

  return { error: 'Could not update password right now. Please try again.' }
}

export async function changeAuthenticatedPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error: string | null }> {
  const passwordAttributes = {
    currentPassword,
    password: newPassword,
  }
  const { error } = await supabase.auth.updateUser(passwordAttributes)

  if (!error) {
    return { error: null }
  }

  const message = error.message.toLowerCase()

  if (
    message.includes('invalid current password') ||
    message.includes('current password') ||
    message.includes('incorrect password')
  ) {
    return { error: 'The current password you entered is incorrect.' }
  }

  if (
    message.includes('same password') ||
    message.includes('different password') ||
    message.includes('new password should be different')
  ) {
    return { error: 'Your new password must be different from your current password.' }
  }

  if (message.includes('password should be at least') || message.includes('weak password')) {
    return { error: 'This password does not meet the required security rules. Please choose a stronger password.' }
  }

  if (message.includes('auth session missing') || message.includes('jwt') || message.includes('session')) {
    return { error: 'Your session has expired. Please log in again before changing your password.' }
  }

  if (
    message.includes('reauthentication') ||
    message.includes('re-authentication') ||
    message.includes('recent login') ||
    message.includes('nonce') ||
    message.includes('log in again')
  ) {
    return { error: 'Additional verification is required before changing your password. Please log out, log in again, and retry.' }
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return { error: 'Too many attempts. Please wait a moment and try again.' }
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return { error: 'Network error. Please check your connection and try again.' }
  }

  return { error: 'We could not change your password. Please try again.' }
}

export async function requestEmailChange(newEmail: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim() },
    { emailRedirectTo: `${window.location.origin}/business-home` }
  )

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
