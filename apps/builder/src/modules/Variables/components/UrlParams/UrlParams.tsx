import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { QueryParams, RouteParams } from '@plitzi/sdk-shared';

export type UrlParamsProps = {
  className?: string;
};

type Pair = { key: string; value: string };

/** A repeated param arrives as an array; the editor shows one row, which is what an author is testing with. */
const asPairs = (params: QueryParams | undefined): Pair[] =>
  Object.entries(params ?? {}).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(',') : (value ?? '')
  }));

/** Blank keys are dropped rather than stored: a half-typed row is not a parameter yet. */
const asParams = (pairs: Pair[]): QueryParams =>
  pairs.reduce<QueryParams>((acum, { key, value }) => {
    if (key.trim()) {
      acum[key.trim()] = value;
    }

    return acum;
  }, {});

/**
 * The URL the page is being tried on.
 *
 * The editor's own address says nothing about the page inside it, so a route that takes a `:slug`, a variable that
 * switches on `?plan=pro` or a binding that reads the hostname had no way to be exercised without publishing. What
 * is set here is laid over the browser's own values in `NavigationProvider`, which is the one place that publishes
 * `navigation.*` — so the canvas, the preview pane, the variable list and every server-driven element resolve
 * against the same tested URL rather than each against its own idea of one.
 *
 * The route params of the page being edited are listed even when empty, because the page declaring one is the fact
 * an author needs to see; a query param has no such declaration, so those are added by hand.
 */
const UrlParams = ({ className = '' }: UrlParamsProps) => {
  const [[urlTest, routeParams, hostname]] = useBuilderStore([
    'urlTest',
    'navigation.routeParams',
    'navigation.hostname'
  ]);
  const [queryPairs, setQueryPairs] = useState<Pair[]>(() => asPairs(urlTest?.queryParams));
  const [, setUrlTest] = useBuilderStore('urlTest');

  const routeKeys = useMemo(() => Object.keys(routeParams), [routeParams]);

  const publish = useCallback(
    (changes: { routeParams?: RouteParams; queryParams?: QueryParams; hostname?: string }) =>
      setUrlTest(current => ({
        routeParams: {},
        queryParams: {},
        hostname: '',
        ...current,
        ...changes
      })),
    [setUrlTest]
  );

  const handleChangeRoute = useCallback(
    (name: string) => (value: string) => publish({ routeParams: { ...urlTest?.routeParams, [name]: value } }),
    [publish, urlTest?.routeParams]
  );

  const handleChangeQuery = useCallback(
    (index: number, field: keyof Pair) => (value: string) => {
      const next = queryPairs.map((pair, position) => (position === index ? { ...pair, [field]: value } : pair));
      setQueryPairs(next);
      publish({ queryParams: asParams(next) });
    },
    [publish, queryPairs]
  );

  const handleAddQuery = useCallback(() => setQueryPairs(current => [...current, { key: '', value: '' }]), []);

  const handleRemoveQuery = useCallback(
    (index: number) => () => {
      const next = queryPairs.filter((_, position) => position !== index);
      setQueryPairs(next);
      publish({ queryParams: asParams(next) });
    },
    [publish, queryPairs]
  );

  const handleChangeHostname = useCallback((value: string) => publish({ hostname: value }), [publish]);

  const handleReset = useCallback(() => {
    setQueryPairs([]);
    setUrlTest(undefined, { unmount: true });
  }, [setUrlTest]);

  return (
    <Flex direction="column" gap={3} className={`overflow-auto p-1 ${className}`}>
      <span className="text-xs text-gray-500">
        Try the page on another URL. What is set here overrides the editor&apos;s own address everywhere the page reads
        it — variable rules, bindings, server-driven sections and an action&apos;s input.
      </span>

      <Flex direction="column" gap={1}>
        <span className="text-xs font-medium">Route parameters</span>
        {routeKeys.length === 0 && <span className="text-xs text-gray-500">This page&apos;s path takes none.</span>}
        {routeKeys.map(name => (
          <Input
            key={name}
            size="xs"
            label={name}
            value={String(urlTest?.routeParams[name] ?? '')}
            placeholder="empty"
            onChange={handleChangeRoute(name)}
          />
        ))}
      </Flex>

      <Flex direction="column" gap={1}>
        <span className="text-xs font-medium">Query parameters</span>
        {queryPairs.map((pair, index) => (
          <Flex key={index} gap={1} items="center">
            <Input size="xs" value={pair.key} placeholder="name" onChange={handleChangeQuery(index, 'key')} />
            <Input size="xs" value={pair.value} placeholder="value" onChange={handleChangeQuery(index, 'value')} />
            <Button size="xs" intent="danger" title="Remove" onClick={handleRemoveQuery(index)}>
              <Button.Icon icon="fa-solid fa-trash" />
            </Button>
          </Flex>
        ))}
        <Button size="xs" intent="secondary" onClick={handleAddQuery}>
          Add parameter
        </Button>
      </Flex>

      <Flex direction="column" gap={1}>
        <span className="text-xs font-medium">Hostname</span>
        <Input
          size="xs"
          value={urlTest?.hostname ?? ''}
          placeholder={hostname || 'example.com'}
          onChange={handleChangeHostname}
        />
      </Flex>

      <Button size="xs" intent="secondary" onClick={handleReset}>
        Back to the editor&apos;s own URL
      </Button>
    </Flex>
  );
};

export default UrlParams;
