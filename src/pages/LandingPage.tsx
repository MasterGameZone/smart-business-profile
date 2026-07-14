import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import ScrollReveal from '../components/ScrollReveal.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { getPublicBusinessProfiles } from '../lib/businessProfileService.ts'
import type { PublicBusinessProfileRow } from '../types/businessProfile.ts'
import { getRecentlyViewedBusinesses, mapRecentlyViewedToPublicProfile } from '../utils/recentlyViewed.ts'
import { getRankedBusinessSearchResults } from '../utils/businessSearch.ts'

const features = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
      </svg>
    ),
    title: 'Professional Profiles',
    description: 'Businesses can publish contact details, profile information, QR code, and public links in one place.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
      </svg>
    ),
    title: 'QR and Public Link',
    description: 'Every saved profile can be shared through a public link and QR code.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
    ),
    title: 'Business Discovery',
    description: 'Visitors can browse public businesses and search by name, category, or location.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h2l2.5 5.5L6 13a11 11 0 005 5l2.5-1.5L19 19v2a2 2 0 01-2 2A16 16 0 011 7a2 2 0 012-2z" />
      </svg>
    ),
    title: 'Instant Contact',
    description: 'Public profiles help visitors call, WhatsApp, email, visit websites, or open maps where available.',
  },
]

const ownerBenefits = [
  'Create and manage professional business profiles',
  'Add contact buttons, services, working hours, images, and social links',
  'Share your public profile link or QR code with customers',
]

const visitorBenefits = [
  'Browse public businesses without signing up',
  'Search by business name, category, or location',
  'Open profiles and contact businesses quickly',
]

const darkCardClass =
  'rounded-3xl border border-white/10 bg-white p-6 shadow-[0_28px_80px_-42px_rgba(2,12,27,0.95)] backdrop-blur-md sm:p-8'

const sectionHeadingClass = 'text-xl font-bold tracking-tight text-black sm:text-2xl md:text-3xl'
type RecommendationState = 'idle' | 'loading' | 'found' | 'empty' | 'error'

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}...`
}

function getInitials(name: string): string {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'SB'
}

function LandingPage() {
  const navigate = useNavigate()
  const { user, isLoading, accountMode } = useAuth()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [homeSearchQuery, setHomeSearchQuery] = useState('')
  const [publicBusinesses, setPublicBusinesses] = useState<PublicBusinessProfileRow[]>([])
  const [recentlyViewedBusinesses, setRecentlyViewedBusinesses] = useState<PublicBusinessProfileRow[]>([])
  const [recommendationState, setRecommendationState] = useState<RecommendationState>('idle')
  const [recommendedBusinesses, setRecommendedBusinesses] = useState<PublicBusinessProfileRow[]>([])

  const handleSectionScroll = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const footerLinks = [
    { label: 'Businesses', type: 'route' as const, value: '/directory' },
    { label: 'Features', type: 'scroll' as const, value: 'features' },
    { label: 'Pricing', type: 'hash' as const, value: '#pricing' },
    { label: 'FAQ', type: 'hash' as const, value: '#faq' },
    { label: 'Login', type: 'route' as const, value: '/login' },
    { label: 'Create Profile', type: 'route' as const, value: '/create-profile' },
    { label: 'Privacy', type: 'hash' as const, value: '#privacy' },
    { label: 'Terms', type: 'hash' as const, value: '#terms' },
  ]

  const focusHomeSearch = () => {
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    searchInputRef.current?.focus()
  }



  usePageMeta(
    user
      ? {
          title: 'Home | Smart Business Profile',
          description: 'Search businesses, browse recommendations, and create your business profile.',
        }
      : {
          title: 'Smart Business Profile | Create and Discover Local Business Profiles',
          description:
            'Create a professional digital business profile or browse public businesses with contact buttons, QR codes, images, and business discovery.',
        }
  )

  useEffect(() => {
    if (!user) {
      setPublicBusinesses([])
      setRecentlyViewedBusinesses([])
      setRecommendedBusinesses([])
      setRecommendationState('idle')
      return
    }

    let isActive = true

    const loadRecommendations = async () => {
      setRecommendationState('loading')

      try {
        const result = await getPublicBusinessProfiles()
        if (!isActive) return

        setPublicBusinesses(result)
        const limitedResults = result.slice(0, 4)
        setRecommendedBusinesses(limitedResults)
        setRecommendationState(limitedResults.length > 0 ? 'found' : 'empty')
      } catch (error) {
        if (!isActive) return

        console.error('Failed to load recommended businesses:', error)
        setPublicBusinesses([])
        setRecommendedBusinesses([])
        setRecommendationState('error')
      }
    }

    loadRecommendations()

    return () => {
      isActive = false
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const recentlyViewed = getRecentlyViewedBusinesses(user.id).map(mapRecentlyViewedToPublicProfile)
    setRecentlyViewedBusinesses(recentlyViewed)
  }, [user])

  useEffect(() => {
    if (!isLoading && user && accountMode === 'business_owner') {
      navigate('/business-home', { replace: true })
    }
  }, [accountMode, isLoading, navigate, user])

  const activeSearchQuery = homeSearchQuery.trim().toLowerCase()
  const hasActiveSearch = activeSearchQuery.length > 0

  const liveSearchResults = useMemo(() => {
    return getRankedBusinessSearchResults(publicBusinesses, activeSearchQuery)
  }, [activeSearchQuery, publicBusinesses])

  const clearHomeSearch = () => {
    setHomeSearchQuery('')
    focusHomeSearch()
  }


  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#eef4fa] text-black">
        <AppHeader />
        <main className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl items-center justify-center px-4 py-10">
          <div className="flex items-center gap-3 text-sm text-black" role="status" aria-live="polite">
            <svg className="h-5 w-5 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading home...
          </div>
        </main>
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen bg-[#eef4fa] text-black">
        <AppHeader />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <section className="mb-8 sm:mb-10">
            <div className="mb-5 sm:mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
                Find trusted businesses near you
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-black sm:text-base">
                Search, save, and connect with businesses from one place.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <label htmlFor="customer-home-search" className="sr-only">
                  Search businesses, categories, services, or locations
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
                  ref={searchInputRef}
                  id="customer-home-search"
                  type="text"
                  value={homeSearchQuery}
                  onChange={(event) => setHomeSearchQuery(event.target.value)}
                  placeholder="Search businesses, categories, services, or locations"
                  className="w-full rounded-full border border-white/10 bg-white/[0.08] py-3 pl-11 pr-4 text-sm text-black placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </div>


            </div>
          </section>

          {hasActiveSearch && (
            <section className="mb-8 sm:mb-10" aria-labelledby="search-results-heading">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 id="search-results-heading" className="text-xl font-bold tracking-tight text-black sm:text-2xl">
                    Search Results
                  </h2>
                  <p className="mt-1 text-sm text-black">
                    {liveSearchResults.length > 0
                      ? `Showing ${liveSearchResults.length} matches for "${homeSearchQuery.trim()}"`
                      : 'No businesses found matching your search.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearHomeSearch}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Clear Search
                </button>
              </div>

              {liveSearchResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {liveSearchResults.map((profile) => (
                    <article
                      key={`search-${profile.id}`}
                      className="flex h-full flex-col rounded-3xl border border-white/10 bg-white p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md"
                    >
                      <div className="mb-4 flex items-start gap-3">
                        {profile.logo_url ? (
                          <img
                            src={profile.logo_url}
                            alt={`${profile.business_name} logo`}
                            className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-sky-400/10 text-sm font-semibold text-sky-700">
                            {getInitials(profile.business_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-black">{profile.business_name}</h3>
                          <p className="truncate text-sm text-black">{profile.business_category}</p>
                          {profile.address && <p className="mt-1 truncate text-xs text-black">{profile.address}</p>}
                        </div>
                      </div>

                      <p className="flex-1 text-sm leading-relaxed text-black">
                        {profile.about_business
                          ? truncate(profile.about_business, 120)
                          : 'Open the full profile to view business details and contact options.'}
                      </p>

                      <button
                        type="button"
                        onClick={() => navigate(`/business/${profile.slug}`)}
                        className="mt-5 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                      >
                        View Profile
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-sm leading-relaxed text-black">
                    Try a business name, category, or owner name that already appears in the directory.
                  </p>
                </div>
              )}
            </section>
          )}


          <section className="mb-8 sm:mb-10" aria-labelledby="recently-viewed-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="recently-viewed-heading" className="text-xl font-bold tracking-tight text-black sm:text-2xl">
                  Recently Viewed Businesses
                </h2>
                <p className="mt-1 text-sm text-black">
                  Quick access to businesses you open most recently.
                </p>
              </div>
            </div>

            {recentlyViewedBusinesses.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {recentlyViewedBusinesses.map((profile) => (
                  <article
                    key={`recent-${profile.id}`}
                    className="flex h-full flex-col rounded-3xl border border-white/10 bg-white p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md"
                  >
                    <div className="mb-4 flex items-start gap-3">
                      {profile.logo_url ? (
                        <img
                          src={profile.logo_url}
                          alt={`${profile.business_name} logo`}
                          className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-sky-400/10 text-sm font-semibold text-sky-700">
                          {getInitials(profile.business_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-black">{profile.business_name}</h3>
                        <p className="truncate text-sm text-black">{profile.business_category}</p>
                        {profile.address && <p className="mt-1 truncate text-xs text-black">{profile.address}</p>}
                      </div>
                    </div>

                    <p className="flex-1 text-sm leading-relaxed text-black">
                      {profile.owner_name ? `Viewed from ${profile.owner_name}'s public profile.` : 'Recently opened public business profile.'}
                    </p>

                    <button
                      type="button"
                      onClick={() => navigate(`/business/${profile.slug}`)}
                      className="mt-5 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      View Profile
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm leading-relaxed text-black">
                    No recently viewed businesses yet. Start exploring businesses to see them here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={focusHomeSearch}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Browse Businesses
                </button>
              </div>
            )}
          </section>

          <section className="mb-8 sm:mb-10" aria-labelledby="local-business-support-heading">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-[0_22px_48px_-30px_rgba(15,23,42,0.26),0_12px_24px_-24px_rgba(15,23,42,0.18)] sm:px-7 sm:py-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M17 20a4 4 0 0 0-8 0m8 0H7m10 0h3m-3 0v-.5a3.5 3.5 0 0 0-7 0v.5m7-8a3 3 0 1 0-6 0 3 3 0 0 0 6 0zm-9 1a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0zm12 0a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z"
                  />
                </svg>
                Community Initiative
              </div>

              <div className="mt-4 max-w-3xl">
                <h2 id="local-business-support-heading" className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
                  <span className="block">Help Build Your</span>
                  <span className="block">Local Business Network</span>
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-black sm:text-base">
                  Know a trusted local business that is not listed yet? Help them create a professional digital presence and become part of a platform built with its community.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Support a Local Business
                </button>

                <button
                  type="button"
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19V6m0 13-4-4m4 4 4-4M5 5h14" />
                  </svg>
                  View My Local Impact
                </button>
              </div>

              <div className="mt-5 flex items-start gap-2 text-sm text-black">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9h.01M11 12h1v4h1" />
                </svg>
                <p>You do not just use Smart Business Profile. You help build it.</p>
              </div>
            </div>
          </section>

          <section className="mb-8 sm:mb-10" aria-labelledby="recommended-businesses-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="recommended-businesses-heading" className="text-xl font-bold tracking-tight text-black sm:text-2xl">
                  Recommended Businesses
                </h2>
                <p className="mt-1 text-sm text-black">
                  Public profiles you can explore right away.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="hidden rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:inline-flex"
              >
                Explore Businesses
              </button>
            </div>

            {recommendationState === 'loading' && (
              <div className="flex min-h-[14rem] items-center justify-center" role="status" aria-live="polite">
                <div className="flex items-center gap-3 text-sm text-black">
                  <svg className="h-5 w-5 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading recommendations...
                </div>
              </div>
            )}

            {recommendationState === 'error' && (
              <div>
                <p className="text-sm leading-relaxed text-black">
                  Recommendations will appear here based on your location and activity.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/directory')}
                  className="mt-5 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Explore Businesses
                </button>
              </div>
            )}

            {recommendationState === 'empty' && (
              <div>
                <p className="text-sm leading-relaxed text-black">
                  Recommendations will appear here based on your location and activity.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/directory')}
                  className="mt-5 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Explore Businesses
                </button>
              </div>
            )}

            {recommendationState === 'found' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {recommendedBusinesses.map((profile) => (
                    <article
                      key={profile.id}
                      className="flex h-full flex-col rounded-3xl border border-white/10 bg-white p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md"
                    >
                      <div className="mb-4 flex items-start gap-3">
                        {profile.logo_url ? (
                          <img
                            src={profile.logo_url}
                            alt={`${profile.business_name} logo`}
                            className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-sky-400/10 text-sm font-semibold text-sky-700">
                            {getInitials(profile.business_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-black">{profile.business_name}</h3>
                          <p className="truncate text-sm text-black">{profile.business_category}</p>
                          {profile.address && <p className="mt-1 truncate text-xs text-black">{profile.address}</p>}
                        </div>
                      </div>

                      <p className="flex-1 text-sm leading-relaxed text-black">
                        {profile.about_business
                          ? truncate(profile.about_business, 120)
                          : 'Open the full profile to view business details and contact options.'}
                      </p>

                      <button
                        type="button"
                        onClick={() => navigate(`/business/${profile.slug}`)}
                        className="mt-5 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                      >
                        View Profile
                      </button>
                    </article>
                  ))}
                </div>

                <div className="mt-4 sm:hidden">
                  <button
                    type="button"
                    onClick={() => navigate('/directory')}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                  >
                    Explore Businesses
                  </button>
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="create-business-cta-heading" className="border-t border-white/10 pt-5 sm:pt-6">
            <div className="max-w-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Own a business?</p>
                  <h2 id="create-business-cta-heading" className="mt-1 text-base font-semibold tracking-tight text-black sm:text-lg">
                    Create your digital business profile.
                  </h2>
                  <p className="mt-1 max-w-lg text-xs leading-relaxed text-black sm:text-sm">
                    Publish your details, share a public link, and help customers contact you faster.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/create-profile')}
                  className="inline-flex items-center justify-center self-start rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-4 py-2 text-xs font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950 sm:text-sm"
                >
                  Create Business Profile
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#eef4fa] text-black">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="landing-ambient-drift absolute inset-x-[-18%] top-[-12rem] h-[34rem] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_55%)] blur-3xl" />
        <div
          className="landing-ambient-drift absolute right-[-20%] top-[18rem] h-[28rem] w-[48rem] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.14),transparent_58%)] blur-3xl"
          style={{ animationDelay: '-7s' }}
        />
        <div className="landing-streak-float absolute left-[-12%] top-28 h-40 w-[124%] rotate-[-8deg] bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.08),rgba(59,130,246,0.14),transparent)] blur-3xl" />
        <div
          className="landing-streak-float absolute left-[-10%] top-[34rem] h-48 w-[120%] rotate-[6deg] bg-[linear-gradient(90deg,transparent,rgba(14,165,233,0.05),rgba(96,165,250,0.12),transparent)] blur-[90px]"
          style={{ animationDelay: '-11s' }}
        />
      </div>
      <AppHeader />

      <main className="relative">
        <section
          aria-label="Hero"
          className="relative px-4 py-16 text-center sm:py-20 lg:py-24"
        >
          <ScrollReveal className="mx-auto max-w-4xl">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-white/8 px-3 py-1 text-[11px] font-semibold text-blue-600 backdrop-blur sm:mb-6 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
              Built for business owners and visitors
            </span>

            <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-black sm:mb-5 sm:text-4xl md:text-5xl lg:text-6xl">
              Create your business profile.{' '}
              <span className="bg-[linear-gradient(90deg,#e2f3ff_0%,#7dd3fc_35%,#60a5fa_70%,#c4b5fd_100%)] bg-clip-text text-transparent">
                Get discovered faster.
              </span>
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-black sm:mb-10 sm:text-lg lg:text-xl">
              Smart Business Profile helps owners publish professional digital profiles,
              while visitors can browse public businesses and contact them without signing up.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#2563eb_0%,#0284c7_55%,#0f172a_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.55)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm font-medium text-black backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                Browse Businesses
              </button>
            </div>
          </ScrollReveal>
        </section>

        <section className="relative px-4 py-16" aria-label="Audience paths">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
            <ScrollReveal delayMs={60} className="h-full">
              <div className={`${darkCardClass} h-full`}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">Business Owners</p>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-black sm:text-2xl">Build a professional profile customers can trust</h2>
                <p className="mb-6 text-sm leading-relaxed text-black sm:text-base">
                  Create a public business profile, manage it from your dashboard, and share it through a link or QR code.
                </p>
                <ul className="space-y-3">
                  {ownerBenefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3 text-sm text-black">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/12 text-sky-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={140} className="h-full">
              <div className={`${darkCardClass} h-full`}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">Visitors</p>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-black sm:text-2xl">Find and contact businesses quickly</h2>
                <p className="mb-6 text-sm leading-relaxed text-black sm:text-base">
                  Browse public business profiles, search the directory, and contact businesses without creating an account.
                </p>
                <ul className="space-y-3">
                  {visitorBenefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3 text-sm text-black">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/12 text-cyan-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="relative px-4 py-16" aria-label="Who it is for">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal className="mb-8 text-center">
              <h2 className={sectionHeadingClass}>
                Built for local businesses of every type
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-black">
                From professionals to local service providers, Smart Business Profile gives businesses a simple public profile visitors can find and contact.
              </p>
            </ScrollReveal>

            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:items-stretch md:gap-5">
              <ScrollReveal delayMs={60} className="mx-auto md:mx-0">
                <div className="mx-auto flex aspect-square w-full max-w-[19rem] items-center justify-center rounded-3xl border border-white/10 bg-white px-6 py-6 text-center shadow-[0_14px_30px_-24px_rgba(2,12,27,0.95)] backdrop-blur-sm sm:max-w-[20rem] sm:px-8 md:h-full md:max-w-none md:aspect-auto">
                  <div className="space-y-1 text-sm font-medium leading-relaxed text-black sm:text-base">
                    <p>Business type preview</p>
                    <p>Animation coming soon</p>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={140}>
                <div className="rounded-3xl border border-white/10 bg-white px-6 py-6 shadow-[0_14px_30px_-24px_rgba(2,12,27,0.95)] backdrop-blur-sm sm:px-8">
                  <div className="space-y-4 text-sm leading-relaxed text-black sm:text-base md:text-left">
                    <p>
                      No matter what kind of local business you run, Smart Business Profile gives you{' '}
                      <span className="font-medium text-black">one clean public page</span> to
                      present the <span className="font-medium text-black">details customers look for first</span> -
                      your contact options, services, location, working hours, business story,
                      gallery, and social links.
                    </p>
                    <p>
                      It helps visitors understand what you offer, trust your presence, and{' '}
                      <span className="font-medium text-black">contact you instantly</span>{' '}
                      through call, WhatsApp, email, website, or maps without needing to install any
                      app.
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section id="features" className="relative px-4 py-16" aria-label="Features">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal className="mb-8 text-center">
              <h2 className={sectionHeadingClass}>Everything needed for a clear business presence</h2>
              <p className="mt-2 text-sm text-black">
                Built for owners who manage profiles and visitors who need quick business information.
              </p>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <ScrollReveal key={feature.title} delayMs={index * 70} className="h-full">
                  <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white p-5 text-left shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md">
                    <div className="mb-4 flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/12 text-sky-300 ring-1 ring-sky-300/15">
                        {feature.icon}
                      </div>
                      <p className="text-sm font-semibold text-black">{feature.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-black">{feature.description}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 py-12 text-center sm:py-14" aria-label="Final call to action">
          <ScrollReveal className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
              Ready to create your business profile?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-black sm:text-base">
              Create a professional public profile, share it with a link or QR code, and help visitors contact you faster.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/create-profile')}
                className="inline-flex w-full items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:min-w-[11rem] sm:px-7 sm:text-base"
              >
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-medium text-black backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:min-w-[11rem] sm:px-7 sm:text-base"
              >
                Browse Businesses
              </button>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="relative border-t border-white/8 px-4 py-8 sm:py-10" aria-label="Footer">
        <ScrollReveal className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 text-center md:flex-row md:items-start md:justify-between md:gap-10 md:text-left">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-black">Smart Business Profile</p>
              <p className="mt-3 text-sm leading-relaxed text-black">
                Create a modern public business profile with a shareable link, QR code, and instant contact options.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-black sm:gap-x-5 md:max-w-xl md:justify-end">
              {footerLinks.map((link) =>
                link.type === 'route' ? (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => navigate(link.value)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {link.label}
                  </button>
                ) : link.type === 'scroll' ? (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => handleSectionScroll(link.value)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {link.label}
                  </button>
                ) : (
                  <a
                    key={link.label}
                    href={link.value}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-black md:mt-7 md:text-left">
            &copy; 2026 Smart Business Profile. All rights reserved.
          </p>
        </ScrollReveal>
      </footer>
    </div>
  )
}

export default LandingPage
