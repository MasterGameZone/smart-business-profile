import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import {
  listCustomerNotifications,
  markCustomerNotificationRead,
} from '../lib/customerNotificationService.ts'
import type { CustomerNotificationRow } from '../types/customerNotification.ts'

function NotificationIcon({ unread }: { unread: boolean }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
        unread ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-[#c7d2df] bg-[#f8fafc] text-slate-500'
      }`}
      aria-hidden="true"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M6.5 9.5a5.5 5.5 0 1 1 11 0v3.17c0 .53.21 1.04.59 1.41l.83.84a1 1 0 0 1-.7 1.71H5.78a1 1 0 0 1-.7-1.7l.84-.85c.37-.37.58-.88.58-1.4V9.5Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function formatNotificationDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="rounded-3xl border border-[#c7d2df] bg-white p-8 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#c7d2df] bg-[#f8fafc] text-slate-500">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path
            d="M6.5 9.5a5.5 5.5 0 1 1 11 0v3.17c0 .53.21 1.04.59 1.41l.83.84a1 1 0 0 1-.7 1.71H5.78a1 1 0 0 1-.7-1.7l.84-.85c.37-.37.58-.88.58-1.4V9.5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-black sm:text-xl">No notifications yet</h2>
      <p className="mt-2 text-sm text-black">
        Important updates about your activity, saved businesses, and community contributions will appear here.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onExplore}
          className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Explore Businesses
        </button>
      </div>
    </section>
  )
}

function CustomerNotificationsPage() {
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const userId = user?.id ?? null
  const [notifications, setNotifications] = useState<CustomerNotificationRow[]>([])
  const [loadedCustomerId, setLoadedCustomerId] = useState<string | null>(null)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [readingNotificationId, setReadingNotificationId] = useState<string | null>(null)

  usePageMeta({
    title: 'Notifications | Smart Business Profile',
    description: 'Stay updated on your activity, community contributions, saved businesses, and account changes.',
  })

  useEffect(() => {
    if (isAuthLoading || !userId) return

    let isCurrent = true

    void listCustomerNotifications(userId)
      .then((nextNotifications) => {
        if (!isCurrent) return
        setNotifications(nextNotifications)
        setLoadedCustomerId(userId)
        setLoadError(null)
      })
      .catch((error) => {
        if (!isCurrent) return
        console.error('Failed to load customer notifications:', error)
        setLoadedCustomerId(userId)
        setLoadError('We could not load your notifications right now. Please try again.')
      })
      .finally(() => {
        if (!isCurrent) return
        setIsLoadingNotifications(false)
      })

    return () => {
      isCurrent = false
    }
  }, [isAuthLoading, userId])

  const markRead = async (notification: CustomerNotificationRow): Promise<void> => {
    if (!userId || notification.is_read || readingNotificationId === notification.id) return

    setReadingNotificationId(notification.id)

    try {
      const updatedNotification = await markCustomerNotificationRead(notification.id, userId)
      setNotifications((currentNotifications) =>
        currentNotifications.map((item) =>
          item.id === updatedNotification.id ? updatedNotification : item
        )
      )
    } catch (error) {
      console.error('Failed to mark customer notification read:', error)
    } finally {
      setReadingNotificationId(null)
    }
  }

  const handleOpenNotification = async (notification: CustomerNotificationRow): Promise<void> => {
    await markRead(notification)

    if (notification.action_url) {
      navigate(notification.action_url)
    }
  }

  const displayError =
    !isAuthLoading && !userId ? 'Please sign in to view your notifications.' : loadError
  const showLoading =
    isAuthLoading || Boolean(userId && (isLoadingNotifications || loadedCustomerId !== userId))
  const secondaryActionClassName =
    'inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#c7d2df] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50'

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Stay updated on your activity, community contributions, saved businesses, and account changes.
          </p>
        </section>

        {showLoading && (
          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)]">
            <p className="text-sm text-black">Loading notifications...</p>
          </section>
        )}

        {!showLoading && displayError && (
          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)]">
            <p className="text-sm text-red-700">{displayError}</p>
          </section>
        )}

        {!showLoading && !displayError && notifications.length > 0 && (
          <section className="rounded-3xl border border-[#c7d2df] bg-white p-4 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-6">
            <div className="space-y-4">
              {notifications.map((notification) => {
                const isUnread = !notification.is_read

                return (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border px-4 py-4 sm:px-5 ${
                      isUnread ? 'border-blue-200 bg-blue-50/70' : 'border-[#c7d2df] bg-[#f8fafc]'
                    }`}
                  >
                    <button
                      type="button"
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                      onClick={() => void handleOpenNotification(notification)}
                    >
                      <div className="flex gap-4">
                        <NotificationIcon unread={isUnread} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {isUnread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />}
                                <h2 className={`text-sm sm:text-base ${isUnread ? 'font-semibold text-black' : 'font-medium text-black'}`}>
                                  {notification.title}
                                </h2>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-black">{notification.message}</p>
                            </div>

                            <p className="shrink-0 text-xs font-medium text-slate-500 sm:pt-0.5">
                              {formatNotificationDate(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>

                    {notification.action_label && notification.action_url ? (
                      <div className="ml-[60px] mt-4">
                        <button
                          type="button"
                          className={secondaryActionClassName}
                          onClick={() => void handleOpenNotification(notification)}
                        >
                          {notification.action_label}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {!showLoading && !displayError && notifications.length === 0 && (
          <EmptyState onExplore={() => navigate('/directory')} />
        )}
      </main>
    </div>
  )
}

export default CustomerNotificationsPage
