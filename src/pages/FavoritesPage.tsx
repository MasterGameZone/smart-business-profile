import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import {
  getFavoriteBusinessesByUser,
  removeFavoriteBusiness,
} from '../lib/favoriteBusinessService.ts'
import type { FavoriteBusinessWithProfileRow } from '../types/favoriteBusiness.ts'

type LoadState = 'loading' | 'found' | 'empty' | 'error'

const ABOUT_TRUNCATE_LENGTH = 160

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}...`
}

function FavoritesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  usePageMeta({
    title: 'Saved Businesses | Smart Business Profile',
    description: 'Businesses you saved for quick access.',
  })

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [favorites, setFavorites] = useState<FavoriteBusinessWithProfileRow[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [removingFavoriteId, setRemovingFavoriteId] = useState<string | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }, [])

  const loadFavorites = useCallback(async () => {
    if (!user) return

    setLoadState('loading')

    try {
      const result = await getFavoriteBusinessesByUser(user.id)
      setFavorites(result)
      setLoadState(result.length > 0 ? 'found' : 'empty')
    } catch (error) {
      console.error('Failed to load favorite businesses:', error)
      setFavorites([])
      setLoadState('error')
    }
  }, [user])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const handleRemoveFavorite = useCallback(
    async (favorite: FavoriteBusinessWithProfileRow) => {
      if (!user || removingFavoriteId) return

      setRemovingFavoriteId(favorite.id)

      try {
        await removeFavoriteBusiness(user.id, favorite.business_profile_id)
        const nextFavorites = favorites.filter((item) => item.id !== favorite.id)
        setFavorites(nextFavorites)
        setLoadState(nextFavorites.length > 0 ? 'found' : 'empty')
        showToast('Saved business removed.')
      } catch (error) {
        console.error('Failed to remove saved business:', error)
        showToast('Unable to remove this saved business right now.', 'error')
      } finally {
        setRemovingFavoriteId(null)
      }
    },
    [favorites, removingFavoriteId, showToast, user]
  )

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)] text-slate-100">
      <ToastContainer toasts={toasts} />
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">Saved Businesses</h1>
          <p className="text-sm text-slate-300">Businesses you saved for quick access.</p>
        </div>

        {loadState === 'loading' && (
          <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
            <svg className="h-6 w-6 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">Loading saved businesses...</span>
          </div>
        )}

        {loadState === 'error' && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-8 w-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="mb-6 font-medium text-slate-200">Unable to load saved businesses right now.</p>
            <button
              type="button"
              onClick={loadFavorites}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Try Again
            </button>
          </div>
        )}

        {loadState === 'empty' && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-16 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md">
            <p className="font-medium text-slate-200">No saved businesses yet.</p>
            <p className="mt-2 text-sm text-slate-400">Save businesses you want to revisit later.</p>
          </div>
        )}

        {loadState === 'found' && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {favorites.map((favorite) => (
              <article
                key={favorite.id}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md"
              >
                <div className="mb-4 flex items-start gap-4">
                  {favorite.business_profile.logo_url ? (
                    <img
                      src={favorite.business_profile.logo_url}
                      alt={`${favorite.business_profile.business_name} logo`}
                      className="h-14 w-14 flex-shrink-0 rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-sky-400/10">
                      <svg className="h-6 w-6 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-50">
                      {favorite.business_profile.business_name}
                    </p>
                    {favorite.business_profile.business_category && (
                      <p className="text-sm text-slate-300">{favorite.business_profile.business_category}</p>
                    )}
                    {favorite.business_profile.address && (
                      <p className="mt-0.5 text-xs text-slate-500">{favorite.business_profile.address}</p>
                    )}
                  </div>
                </div>

                {favorite.business_profile.about_business && (
                  <p className="mb-4 flex-1 text-sm text-slate-300">
                    {truncate(favorite.business_profile.about_business, ABOUT_TRUNCATE_LENGTH)}
                  </p>
                )}

                <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate(`/business/${favorite.business_profile.slug}`)}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                  >
                    View Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveFavorite(favorite)}
                    disabled={removingFavoriteId === favorite.id}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {removingFavoriteId === favorite.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default FavoritesPage
