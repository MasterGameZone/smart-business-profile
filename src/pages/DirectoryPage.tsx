import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { getPublicBusinessProfiles } from '../lib/businessProfileService.ts'
import type { PublicBusinessProfileRow } from '../types/businessProfile.ts'
import { getRankedBusinessSearchResults } from '../utils/businessSearch.ts'

type LoadState = 'loading' | 'found' | 'empty' | 'error'

const ABOUT_TRUNCATE_LENGTH = 140
const ALL_CATEGORIES = 'All Categories'

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}...`
}

function DirectoryPage() {
  const navigate = useNavigate()

  usePageMeta({
    title: 'Business Directory | Smart Business Profile',
    description: 'Browse and discover public business profiles by name, category, and location.',
  })

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [profiles, setProfiles] = useState<PublicBusinessProfileRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)
  const [locationQuery, setLocationQuery] = useState('')

  const loadProfiles = useCallback(async () => {
    setLoadState('loading')
    try {
      const result = await getPublicBusinessProfiles()
      setProfiles(result)
      setLoadState(result.length > 0 ? 'found' : 'empty')
    } catch (error) {
      console.error('Failed to load public business directory:', error)
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(profiles.map((profile) => profile.business_category)))
    unique.sort((a, b) => a.localeCompare(b))
    return [ALL_CATEGORIES, ...unique]
  }, [profiles])

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const location = locationQuery.trim().toLowerCase()

    const matchingProfiles = profiles.filter((profile) => {
      const matchesCategory = selectedCategory === ALL_CATEGORIES || profile.business_category === selectedCategory
      if (!matchesCategory) return false

      const matchesLocation = !location || Boolean(profile.address?.toLowerCase().includes(location))
      if (!matchesLocation) return false

      return true
    })

    return getRankedBusinessSearchResults(matchingProfiles, query)
  }, [profiles, searchQuery, selectedCategory, locationQuery])

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== ALL_CATEGORIES || locationQuery.trim().length > 0

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedCategory(ALL_CATEGORIES)
    setLocationQuery('')
  }, [])

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-black sm:text-3xl">Business Directory</h1>
          <p className="text-sm text-black">Browse published business profiles.</p>
        </div>

        {loadState === 'found' && (
          <div className="mb-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1 sm:max-w-md">
                <label htmlFor="directory-search" className="sr-only">
                  Search businesses
                </label>
                <svg
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
                  />
                </svg>
                <input
                  id="directory-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search businesses..."
                  className="w-full rounded-full border border-white/10 bg-white/[0.08] py-2.5 pl-11 pr-4 text-sm text-black placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </div>

              <div className="relative flex-1 sm:max-w-md">
                <label htmlFor="directory-location" className="sr-only">
                  Search by location or address
                </label>
                <svg
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10.5h.01" />
                </svg>
                <input
                  id="directory-location"
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Search by location or address..."
                  className="w-full rounded-full border border-white/10 bg-white/[0.08] py-2.5 pl-11 pr-4 text-sm text-black placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </div>

              <div className="sm:w-56">
                <label htmlFor="directory-category" className="sr-only">
                  Filter by category
                </label>
                <select
                  id="directory-category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/[0.08] px-4 py-2.5 text-sm text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                >
                  {categories.map((category) => (
                    <option key={category} value={category} className="bg-slate-900 text-slate-50">
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-sm text-black" aria-live="polite">
              {hasActiveFilters
                ? `Showing ${filteredProfiles.length} of ${profiles.length} businesses`
                : `Showing ${profiles.length} businesses`}
            </p>
          </div>
        )}

        {loadState === 'loading' && (
          <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
            <svg className="h-6 w-6 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">Loading businesses...</span>
          </div>
        )}

        {loadState === 'error' && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-8 w-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="mb-6 font-medium text-black">Unable to load businesses.</p>
            <button
              type="button"
              onClick={loadProfiles}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Retry
            </button>
          </div>
        )}

        {loadState === 'empty' && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-[#c7d2df] bg-white px-4 py-16 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sky-400/10">
              <svg className="h-8 w-8 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="font-medium text-black">No businesses have been published yet.</p>
          </div>
        )}

        {loadState === 'found' && filteredProfiles.length === 0 && (
          <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-2xl border border-[#c7d2df] bg-white px-4 py-16 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md">
            <p className="mb-6 font-medium text-black">No businesses found matching your filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Clear Filters
            </button>
          </div>
        )}

        {loadState === 'found' && filteredProfiles.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col rounded-2xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md"
              >
                <div className="mb-4 flex items-start gap-4">
                  {profile.logo_url ? (
                    <img
                      src={profile.logo_url}
                      alt={`${profile.business_name} logo`}
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
                    <p className="truncate text-base font-semibold text-black">{profile.business_name}</p>
                    <p className="text-sm text-black">{profile.business_category}</p>
                    <p className="mt-0.5 text-xs text-black">By {profile.owner_name}</p>
                  </div>
                </div>

                {profile.about_business && (
                  <p className="mb-4 flex-1 text-sm text-black">
                    {truncate(profile.about_business, ABOUT_TRUNCATE_LENGTH)}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <p className="break-all text-xs text-black">{profile.slug}</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/business/${profile.slug}`)}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default DirectoryPage
