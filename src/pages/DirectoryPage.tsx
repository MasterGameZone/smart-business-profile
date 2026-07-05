import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicBusinessProfiles } from '../lib/businessProfileService.ts'
import type { PublicBusinessProfileRow } from '../types/businessProfile.ts'

type LoadState = 'loading' | 'found' | 'empty' | 'error'

const ABOUT_TRUNCATE_LENGTH = 140
const ALL_CATEGORIES = 'All Categories'

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}…`
}

function DirectoryPage() {
  const navigate = useNavigate()

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

    return profiles.filter((profile) => {
      const matchesCategory = selectedCategory === ALL_CATEGORIES || profile.business_category === selectedCategory
      if (!matchesCategory) return false

      const matchesLocation = !location || Boolean(profile.address?.toLowerCase().includes(location))
      if (!matchesLocation) return false

      if (!query) return true

      return (
        profile.business_name.toLowerCase().includes(query) ||
        profile.business_category.toLowerCase().includes(query) ||
        profile.owner_name.toLowerCase().includes(query)
      )
    })
  }, [profiles, searchQuery, selectedCategory, locationQuery])

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== ALL_CATEGORIES || locationQuery.trim().length > 0

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedCategory(ALL_CATEGORIES)
    setLocationQuery('')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 tracking-tight focus:outline-none"
          >
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              SB
            </span>
            Smart Business Profile
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-1.5">Business Directory</h1>
          <p className="text-sm text-gray-500">Browse published business profiles.</p>
        </div>

        {loadState === 'found' && (
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:max-w-md">
                <label htmlFor="directory-search" className="sr-only">
                  Search businesses
                </label>
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                  className="w-full pl-11 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="relative flex-1 sm:max-w-md">
                <label htmlFor="directory-location" className="sr-only">
                  Search by location or address
                </label>
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                  className="w-full pl-11 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500" aria-live="polite">
              {hasActiveFilters
                ? `Showing ${filteredProfiles.length} of ${profiles.length} businesses`
                : `Showing ${profiles.length} businesses`}
            </p>
          </div>
        )}

        {/* ── Loading State ── */}
        {loadState === 'loading' && (
          <div className="flex items-center justify-center min-h-[40vh]" role="status" aria-live="polite">
            <svg className="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">Loading businesses…</span>
          </div>
        )}

        {/* ── Error State ── */}
        {loadState === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-6">Unable to load businesses.</p>
            <button
              type="button"
              onClick={loadProfiles}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty State ── */}
        {loadState === 'empty' && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 bg-white rounded-2xl border border-gray-100 shadow-sm py-16">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">No businesses have been published yet.</p>
          </div>
        )}

        {/* ── No Filter Results ── */}
        {loadState === 'found' && filteredProfiles.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[30vh] text-center px-4 bg-white rounded-2xl border border-gray-100 shadow-sm py-16">
            <p className="text-gray-700 font-medium mb-6">No businesses found matching your filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* ── Business Cards ── */}
        {loadState === 'found' && filteredProfiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col"
              >
                <div className="flex items-start gap-4 mb-4">
                  {profile.logo_url ? (
                    <img
                      src={profile.logo_url}
                      alt={`${profile.business_name} logo`}
                      className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">{profile.business_name}</p>
                    <p className="text-sm text-gray-500">{profile.business_category}</p>
                    <p className="text-xs text-gray-400 mt-0.5">By {profile.owner_name}</p>
                  </div>
                </div>

                {profile.about_business && (
                  <p className="text-sm text-gray-600 mb-4 flex-1">
                    {truncate(profile.about_business, ABOUT_TRUNCATE_LENGTH)}
                  </p>
                )}

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400 break-all">{profile.slug}</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/business/${profile.slug}`)}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all whitespace-nowrap"
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
