import Alert from '@plitzi/plitzi-ui/Alert';
import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useMemo, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import {
  NOTIFICATIONS_FIELDS,
  notificationsProblem,
  splitNotificationsCss,
  withNotificationsCss
} from '@plitzi/sdk-shared/style/notifications';

import ViewSection from '../../../components/ViewSection';

import type { NotificationsSpec } from '@plitzi/sdk-shared/style/notifications';

type Field = keyof NotificationsSpec;

/** What each field is called here, and an example of what it takes — every one a CSS value, a token at best. */
const FIELD_LABELS: Record<Field, { label: string; placeholder: string }> = {
  background: { label: 'Surface', placeholder: 'var(--card)' },
  text: { label: 'Text', placeholder: 'var(--foreground)' },
  success: { label: 'Success accent', placeholder: 'var(--success)' },
  danger: { label: 'Danger accent', placeholder: 'var(--danger)' },
  warning: { label: 'Warning accent', placeholder: 'var(--warning)' },
  info: { label: 'Info accent', placeholder: 'var(--primary)' },
  radius: { label: 'Corner radius', placeholder: '12px' },
  font: { label: 'Font', placeholder: 'var(--font-sans)' },
  fontSize: { label: 'Text size', placeholder: '14px' },
  border: { label: 'Border', placeholder: '1px solid var(--border)' },
  shadow: { label: 'Shadow', placeholder: 'var(--shadow-lg)' },
  padding: { label: 'Padding', placeholder: '12px 14px' },
  minHeight: { label: 'Min height', placeholder: '0px' },
  fontWeight: { label: 'Text weight', placeholder: '500' },
  lineHeight: { label: 'Line height', placeholder: '1.45' },
  iconSize: { label: 'Icon size', placeholder: '18px' },
  iconGap: { label: 'Icon gap', placeholder: '10px' },
  closeColor: { label: 'Close button colour', placeholder: 'var(--muted)' },
  closeOpacity: { label: 'Close button opacity', placeholder: '0.8' },
  progressHeight: { label: 'Progress bar height', placeholder: '2px' }
};

type NotificationFieldProps = {
  field: Field;
  value: string;
  onChange: (field: Field, value: string) => void;
};

const NotificationField = ({ field, value, onChange }: NotificationFieldProps) => {
  const handleChange = useCallback((next: string) => onChange(field, next), [field, onChange]);

  return (
    <Input
      size="sm"
      name={`notifications-${field}`}
      value={value}
      label={FIELD_LABELS[field].label}
      placeholder={FIELD_LABELS[field].placeholder}
      onChange={handleChange}
    />
  );
};

/**
 * How the toasts an `addNotification` step shows look — the space's `notifications`, the same fields authoring and the
 * MCP server write. They are stored as a rule inside the custom CSS; here they are fields of their own, and the
 * custom CSS editor shows the space's CSS without that rule.
 */
const NotificationsSettings = () => {
  const [[storedCss]] = useBuilderStore(['schema.settings.customCss']);
  const { eventBridge } = use(EventBridgeContext);
  const stored = useMemo(() => splitNotificationsCss(typeof storedCss === 'string' ? storedCss : ''), [storedCss]);
  // Each field's own text, so a value being typed — not yet one CSS value — stays on screen until it is.
  const [texts, setTexts] = useState<NotificationsSpec>(stored.notifications);
  const problem = notificationsProblem({ ...texts });

  const handleChange = useCallback(
    (field: Field, value: string) => {
      const next: NotificationsSpec = { ...texts, [field]: value };
      setTexts(next);
      const written = Object.fromEntries(
        Object.entries(next).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''
        )
      );
      if (!notificationsProblem(written)) {
        void eventBridge.emit(
          'main',
          'schemaUpdateSettings',
          withNotificationsCss(stored.customCss, written),
          'customCss'
        );
      }
    },
    [eventBridge, stored.customCss, texts]
  );

  return (
    <ViewSection title="Notifications">
      <p className="text-xs text-gray-500 dark:text-zinc-400">
        How the toasts an Add Notification step shows look — the toast, its icon, its close button and its progress bar.
        One CSS value each; a token follows the theme. Left empty, the library&apos;s own.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {NOTIFICATIONS_FIELDS.map(field => (
          <NotificationField key={field} field={field} value={texts[field] ?? ''} onChange={handleChange} />
        ))}
      </div>
      {problem && (
        <Alert intent="warning" size="xs" solid={false}>
          {problem}
        </Alert>
      )}
    </ViewSection>
  );
};

export default NotificationsSettings;
