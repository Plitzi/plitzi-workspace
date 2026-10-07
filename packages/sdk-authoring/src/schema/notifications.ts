import {
  notificationsCss as notificationsRule,
  notificationsProblem,
  withNotificationsCss as withNotificationsRule
} from '@plitzi/sdk-shared/style/notifications';

import { AuthoringError } from './codes';
import { didYouMean } from './suggest';

import type { NotificationsSpec } from '@plitzi/sdk-shared/style/notifications';

export { NOTIFICATIONS_FIELDS, splitNotificationsCss } from '@plitzi/sdk-shared/style/notifications';
export type { NotificationsSpec } from '@plitzi/sdk-shared/style/notifications';

/** Refuses what would not style anything — the check every writer of `notifications` is held to. */
const checked = (spec: NotificationsSpec | undefined): NotificationsSpec | undefined => {
  const problem = notificationsProblem({ ...spec }, didYouMean);
  if (problem) {
    throw new AuthoringError('notifications-shape', problem);
  }

  return spec;
};

/** The rules that style the toasts, or `''` when there is nothing to say; refuses a spec that is not sound. */
export const notificationsCss = (spec: NotificationsSpec | undefined): string => notificationsRule(checked(spec));

/** The space's custom CSS with its notifications' rules after it; refuses a spec that is not sound. */
export const withNotificationsCss = (customCss: string, spec: NotificationsSpec | undefined): string =>
  withNotificationsRule(customCss, checked(spec));
