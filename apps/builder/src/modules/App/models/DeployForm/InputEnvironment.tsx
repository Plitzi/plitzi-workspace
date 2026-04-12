import ErrorMessage from '@plitzi/plitzi-ui/ErrorMessage';
import Form from '@plitzi/plitzi-ui/Form';
import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { useCallback } from 'react';

import type { Environment } from '@plitzi/sdk-shared';

const environments: Record<
  Environment,
  { value: Environment; label: string; icon: string; dotColor: string; description: string }
> = {
  production: {
    value: 'production',
    label: 'Production',
    icon: 'fa-solid fa-rocket',
    dotColor: 'bg-green-500',
    description: 'Live environment accessible to all users'
  },
  staging: {
    value: 'staging',
    label: 'Staging',
    icon: 'fa-solid fa-vial',
    dotColor: 'bg-yellow-500',
    description: 'Test environment for review and QA'
  },
  development: {
    value: 'development',
    label: 'Development',
    icon: 'fa-solid fa-code',
    dotColor: 'bg-blue-500',
    description: 'Local development environment'
  },
  main: {
    value: 'main',
    label: 'Main',
    icon: 'fa-solid fa-bolt',
    dotColor: 'bg-black',
    description: 'Real-time changes reflected instantly for the main branch'
  }
};

const InputEnvironment = () => (
  <Form.Custom
    name="environment"
    render={function Render({ field: { ref, value, onChange }, fieldState: { error: fieldError } }) {
      const handleChange = useCallback((value: string) => onChange(value), [onChange]);

      return (
        <div ref={ref} className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-sm">
              <Icon icon="fa-solid fa-gear" />
              Environment
            </div>
            <div className="flex justify-between gap-6 text-xs">
              {Object.values(environments).map(env => (
                <div
                  key={env.value}
                  className={clsx(
                    'relative flex grow basis-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-2',
                    {
                      'hover:bg-primary-100 hover:border-primary-300 border-gray-300 dark:border-zinc-600':
                        value !== env.value,
                      'border-primary-500 bg-primary-300': value === env.value
                    }
                  )}
                  onClick={() => handleChange(env.value)}
                >
                  <Icon intent="custom" icon={env.icon} size="xl" />
                  <div>{env.label}</div>
                  {value === env.value && (
                    <Icon
                      icon="fa-solid fa-circle-check"
                      className="text-primary-ui absolute top-1 right-1 group-hover:text-white"
                      title="Selected"
                      size="xl"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1.5 text-xs text-gray-500">
            <div className={clsx('w-1 rounded-full p-1', environments[value as Environment].dotColor)}></div>
            {environments[value as Environment].description}
          </div>
          {fieldError && <ErrorMessage message={fieldError.message} error={!!fieldError.message} />}
        </div>
      );
    }}
  />
);

export default InputEnvironment;
