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
  | 'cancelled_by_employer'
  | 'selected'
  | 'not_selected';

/** Vessel type (motor or sail — determines M/Y or S/Y prefix) */
export type VesselType = 'motor' | 'sail';

/** Vessel operation mode */
export type VesselOperation = 'private' | 'charter';

/** Contract type for crew experience entries */
export type ContractType = 'permanent' | 'rotational' | 'seasonal' | 'crossing' | 'delivery' | 'temporary';

/** Meal options for daywork postings */
export type MealOption = 'breakfast' | 'lunch' | 'dinner';

/** Permanent posting status */
export type PermanentPostingStatus = 'active' | 'in_negotiation' | 'filled' | 'cancelled';

/** Permanent availability for career status */
export type PermanentAvailability = 'immediate' | 'after_notice' | 'not_looking';

/** Salary period for permanent postings */
export type SalaryPeriod = 'monthly' | 'annual';

/** Subscription plan tiers */
export type SubscriptionPlan = 'free' | 'crew_pro' | 'employer_pro';

/** Subscription status from Stripe */
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';
