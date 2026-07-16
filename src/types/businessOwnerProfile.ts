export interface BusinessOwnerProfileRow {
  user_id: string
  name: string | null
  phone_number: string | null
  preferred_city: string | null
  created_at: string
  updated_at: string
}

export interface BusinessOwnerProfileFormValues {
  name: string
  phoneNumber: string
  preferredCity: string
}
