export type BusinessOwnerHelpSuggestionType =
  | 'suggestion'
  | 'help_request'
  | 'issue_problem'
  | 'profile_improvement_help'

export type BusinessOwnerHelpSuggestionStatus = 'submitted' | 'in_review' | 'replied' | 'closed'

export interface BusinessOwnerHelpSuggestionRow {
  id: string
  owner_id: string
  type: BusinessOwnerHelpSuggestionType
  subject: string
  message: string
  status: BusinessOwnerHelpSuggestionStatus
  created_at: string
  updated_at: string
}

export interface CreateBusinessOwnerHelpSuggestionInput {
  type: BusinessOwnerHelpSuggestionType
  subject: string
  message: string
}
