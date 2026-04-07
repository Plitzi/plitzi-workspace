import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import { omit, debounce } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useEffect, useState, useMemo } from 'react';

import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';

import SegmentForm from './models/SegmentForm';
import Segment from './Segment';

import type { SegmentsContextValue, Segment as TSegment } from '@plitzi/sdk-shared';

const Segments = () => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [data, setData] = useState<{ cursor?: string; hasNextPage: boolean; segments: Record<string, TSegment> }>({
    cursor: undefined,
    hasNextPage: false,
    segments: {}
  });
  const { showModal } = useModal();
  const { segmentsFetch, segmentAddMutation } = use(SegmentsContext) as SegmentsContextValue<'builder'>;

  const fetch = useCallback(
    async (name: string, more = false) => {
      setLoading(true);
      const query: Record<string, string> = {};
      if (name) {
        query['definition.name'] = `/.*${name}.*/`;
      }

      const result = await segmentsFetch(query, data.cursor, 20);
      if (result) {
        const { pageInfo, edges } = result;
        if (!(edges as undefined | TSegment[])) {
          setLoading(false);

          return;
        }

        const segments = edges.reduce((acum, segment) => ({ ...acum, [segment.identifier]: segment }), {});
        setData({
          cursor: pageInfo.nextCursor,
          hasNextPage: pageInfo.hasNextPage,
          segments: (more ? { ...data.segments, segments } : segments) as Record<string, TSegment>
        });
        setLoading(false);
      }
    },
    [data, segmentsFetch]
  );

  const fetchDebounce = useMemo(() => debounce(fetch, 500), [fetch]);

  useEffect(() => {
    void fetch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback((identifier: string, segment?: TSegment) => {
    setData(state => {
      const { segments } = state;
      if (!(segments[identifier] as TSegment | undefined)) {
        return state;
      }

      if (!segment) {
        return { ...state, segments: omit(segments, [identifier]) };
      }

      return { ...state, segments: { ...segments, [identifier]: segment } };
    });
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setFilter(value);
      void fetchDebounce(value);
    },
    [fetchDebounce]
  );

  const handleClickAddSegment = useCallback(async () => {
    const response = await showModal<{ name: string; description: string }>(
      <Modal.Header>
        <h4>Add Segment</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <SegmentForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, description } = response;
      void segmentAddMutation(name, description);
      void fetchDebounce(filter);
    }
  }, [showModal, segmentAddMutation, fetchDebounce, filter]);

  const { segments } = data;

  return (
    <Flex direction="column" gap={2} className="segments w-full p-2">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleClickAddSegment} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          New Segment
        </Button>
        <Input placeholder="Search" value={filter} onChange={handleChange} size="sm">
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </Flex>
      <div className="mt-2 h-px bg-gray-200" />
      <Flex direction="column">
        {!loading &&
          Object.values(segments).map((segment, key) => {
            const {
              id,
              identifier,
              definition: { name, description },
              schema: { variables }
            } = segment;

            return (
              <Segment
                key={key}
                id={id}
                identifier={identifier}
                name={name}
                description={description}
                variables={variables}
                onParentRefresh={handleRefresh}
              />
            );
          })}
      </Flex>
    </Flex>
  );
};

export default Segments;
