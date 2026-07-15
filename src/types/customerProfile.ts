export interface CustomerProfileRow {
  user_id: string
  customer_name: string | null
  phone_number: string | null
  preferred_city: string | null
  preferred_area: string | null
  created_at: string
  updated_at: string
}

export interface CustomerProfileFormValues {
  customerName: string
  phoneNumber: string
  preferredCity: string
  preferredArea: string
}
