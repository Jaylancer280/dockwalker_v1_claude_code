/** Role context for dual-role system — every event carries one of these */
export type RoleContext = 'crew' | 'employer' | 'agent';

/** Identity type selected at onboarding */
export type IdentityType = 'crew' | 'agent';

/** Application state machine */
export type ApplicationStatus =
  | 'applied'
  | 'viewed'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'superseded'
  | 'completed'
  | 'cancelled_by_crew'
  | 'cancelled_by_employer';

/** Vessel type */
export type VesselType = 'private' | 'charter';

/** Meal options for daywork postings */
export type MealOption = 'breakfast' | 'lunch' | 'dinner';
