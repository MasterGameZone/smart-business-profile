import { createContext, useContext, useState } from 'react'

export interface ProfileData {
  businessName: string
  ownerName: string
  businessCategory: string
  phoneNumber: string
  whatsappNumber: string
  email: string
  website: string
  address: string
  aboutBusiness: string
  logo: File | null
}

const defaultProfileData: ProfileData = {
  businessName: '',
  ownerName: '',
  businessCategory: '',
  phoneNumber: '',
  whatsappNumber: '',
  email: '',
  website: '',
  address: '',
  aboutBusiness: '',
  logo: null,
}

interface ProfileContextValue {
  profileData: ProfileData
  setProfileData: (data: ProfileData) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfileData)

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return ctx
}
