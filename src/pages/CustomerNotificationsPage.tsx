import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta.ts'

type NotificationState = 'read' | 'unread'

interface NotificationAction {
  label: string
  path?: string
}

interface CustomerNotificationItem {
  id: string
  title: string
  message: string
  dateTime: string
  state: NotificationState
  action?: NotificationAction
}

const placeholderNotifications: CustomerNotificationItem[] = [
  {
    id: 'profile-viewed',
    title: 'Profile viewed',
    message: 'A business profile you saved has new information available.',
    dateTime: 'Today, 10:30 AM',
    state: 'unread',
    action: { label: 'View Business', path: '/favorites' },
  },
  {
    id: 'community-update',
    title: 'Community update',
    message: 'Your local contribution features are being prepared.',
    dateTime: 'Yesterday, 6:15 PM',
    state: 'read',
    action: { label: 'View Community', path: '/customer/community' },
  },
  {
    id: 'account-update',
    title: 'Account update',
    message: 'Your customer account settings page is now available.',
    dateTime: '2 days ago',
    state: 'read',
    action: { label: 'View Settings', path: '/customer/profile-settings' },
  },
]

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

function EmptyState() {
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
      <p className="mt-2 text-sm text-black">Important updates will appear here.</p>
    </section>
  )
}

function CustomerNotificationsPage() {
  const navigate = useNavigate()

  usePageMeta({
    title: 'Notifications | Smart Business Profile',
    description: 'Stay updated on your activity, community contributions, saved businesses, and account changes.',
  })

  const notifications = placeholderNotifications
  const secondaryActionClassName =
    'inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#c7d2df] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50'

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <div className="inline-flex items-center rounded-full border border-[#c7d2df] bg-white px-3 py-1 text-xs font-semibold text-blue-700">
            UI Preview
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-black sm:text-3xl">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Stay updated on your activity, community contributions, saved businesses, and account changes.
          </p>
        </section>

        {notifications.length > 0 ? (
          <section className="rounded-3xl border border-[#c7d2df] bg-white p-4 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-6">
            <div className="space-y-4">
              {notifications.map((notification) => {
                const isUnread = notification.state === 'unread'

                return (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border px-4 py-4 sm:px-5 ${
                      isUnread ? 'border-blue-200 bg-blue-50/70' : 'border-[#c7d2df] bg-[#f8fafc]'
                    }`}
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

                          <p className="shrink-0 text-xs font-medium text-slate-500 sm:pt-0.5">{notification.dateTime}</p>
                        </div>

                        {notification.action ? (
                          <div className="mt-4">
                            <button
                              type="button"
                              className={secondaryActionClassName}
                              onClick={() => notification.action?.path && navigate(notification.action.path)}
                            >
                              {notification.action.label}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  )
}

export default CustomerNotificationsPage
