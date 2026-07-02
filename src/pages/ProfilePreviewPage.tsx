import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'

function ProfilePreviewPage() {
  const navigate = useNavigate()
  const { profileData } = useProfile()

  const logoUrl = useMemo(() => {
    if (profileData.logo) {
      return URL.createObjectURL(profileData.logo)
    }
    return null
  }, [profileData.logo])

  useEffect(() => {
    return () => {
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl)
      }
    }
  }, [logoUrl])

  const displayPhone = profileData.phoneNumber.trim()
  const displayWhatsApp = profileData.whatsappNumber.trim() || displayPhone
  const displayEmail = profileData.email.trim()

  const firstLetter = profileData.businessName.trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-[480px] mx-auto">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header accent */}
          <div className="h-24 bg-blue-600" />

          <div className="px-6 pb-8 -mt-12">
            {/* Logo / Placeholder */}
            <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md flex items-center justify-center overflow-hidden mx-auto">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Business logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-blue-600">
                  {firstLetter || '?'}
                </span>
              )}
            </div>

            {/* Business Name */}
            <h1 className="mt-4 text-2xl font-bold text-gray-900 text-center">
              {profileData.businessName}
            </h1>

            {/* Category */}
            {profileData.businessCategory && (
              <p className="mt-1 text-sm text-blue-600 font-medium text-center">
                {profileData.businessCategory}
              </p>
            )}

            {/* Owner */}
            {profileData.ownerName && (
              <p className="mt-1 text-sm text-gray-500 text-center">
                Owned by {profileData.ownerName}
              </p>
            )}

            {/* About */}
            {profileData.aboutBusiness && (
              <p className="mt-4 text-sm text-gray-600 text-center leading-relaxed">
                {profileData.aboutBusiness}
              </p>
            )}

            {/* Divider */}
            <div className="my-6 border-t border-gray-100" />

            {/* Contact details */}
            <div className="space-y-3">
              {displayPhone && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg
                    className="w-5 h-5 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <span>{displayPhone}</span>
                </div>
              )}

              {profileData.whatsappNumber.trim() && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg
                    className="w-5 h-5 text-gray-400 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span>{profileData.whatsappNumber}</span>
                </div>
              )}

              {profileData.email && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg
                    className="w-5 h-5 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{profileData.email}</span>
                </div>
              )}

              {profileData.website && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg
                    className="w-5 h-5 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  </svg>
                  <a
                    href={profileData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    {profileData.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}

              {profileData.address && (
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <svg
                    className="w-5 h-5 text-gray-400 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="whitespace-pre-line">{profileData.address}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-100" />

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {displayPhone && (
                <a
                  href={`tel:${displayPhone}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  Call
                </a>
              )}

              {displayWhatsApp && (
                <a
                  href={`https://wa.me/${displayWhatsApp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-green-600 rounded-full hover:bg-green-700 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              )}

              {displayEmail && (
                <a
                  href={`mailto:${displayEmail}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-gray-800 rounded-full hover:bg-gray-900 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Email
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Back to Edit */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/create-profile')}
            className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-gray-700 bg-white rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors shadow-sm"
          >
            Back to Edit
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfilePreviewPage
