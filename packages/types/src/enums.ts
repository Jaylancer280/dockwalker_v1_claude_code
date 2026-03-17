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

/** Vessel type (motor or sail — determines M/Y or S/Y prefix) */
export type VesselType = 'motor' | 'sail';

/** Vessel operation mode */
export type VesselOperation = 'private' | 'charter';

/** Contract type for crew experience entries */
export type ContractType = 'permanent' | 'rotational' | 'seasonal' | 'crossing' | 'delivery' | 'temporary';

/** Meal options for daywork postings */
export type MealOption = 'breakfast' | 'lunch' | 'dinner';

/** Subscription plan tiers */
export type SubscriptionPlan = 'free' | 'crew_pro' | 'crew_unlimited';

/** Subscription status from Stripe */
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';
