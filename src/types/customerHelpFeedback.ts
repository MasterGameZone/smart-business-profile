export type CustomerHelpFeedbackRequestType =
  | 'Contact Support'
  | 'Problem Report'
  | 'Feedback'

export type CustomerHelpFeedbackStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Resolved'
  | 'Closed'

export type CustomerHelpFeedbackCategory =
  | 'Account issue'
  | 'Business profile issue'
  | 'Search or directory issue'
  | 'Saved businesses issue'
  | 'Reviews or reports issue'
  | 'Community feature issue'
  | 'Technical problem'
  | 'Other'
  | 'General feedback'
  | 'Feature suggestion'
  | 'Design feedback'
  | 'Bug feedback'
  | 'Category suggestion'

export type CustomerSatisfactionLevel =
  | 'Very satisfied'
  | 'Satisfied'
  | 'Neutral'
  | 'Unsatisfied'
  | 'Very unsatisfied'

export interface CustomerHelpFeedbackRequestInsert {
  customer_id: string
  request_type: CustomerHelpFeedbackRequestType
  category: CustomerHelpFeedbackCategory | null
  title: string
  message: string
  satisfaction_level: CustomerSatisfactionLevel | null
  status: CustomerHelpFeedbackStatus
}

export interface CreateCustomerHelpFeedbackRequestPayload {
  customerId: string
  requestType: CustomerHelpFeedbackRequestType
  category: CustomerHelpFeedbackCategory | null
  title: string
  message: string
  satisfactionLevel: CustomerSatisfactionLevel | null
}
