import type { PushNotification } from '../push-delivery';

export interface NotifyContext {
  recipientPersonId: string;
  notification: PushNotification;
  roleContext: 'crew' | 'employer';
}
