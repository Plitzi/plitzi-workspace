// Packages
import React, { useCallback, use, useEffect, useState, useMemo } from 'react';
import omit from 'lodash/omit';
import debounce from 'lodash/debounce';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';

// Relatives
import SegmentsContext from './SegmentsContext';
import Segment from './Segment';
import SegmentForm from './models/SegmentForm';

/** @returns {React.ReactElement} */
const Segments = () => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [data, setData] = useState({ cursor: undefined, hasNextPage: false, segments: {} });
  const { showModal } = useModal();
  const { segmentsFetch, segmentAddMutation } = use(SegmentsContext);

  const fetch = useCallback(
    async (name, more = false) => {
      setLoading(true);
      const query = {};
      if (name) {
        query['definition.name'] = `/.*${name}.*/`;
      }

      const result = await segmentsFetch(query, data.cursor, 20);
      if (result) {
        const { pageInfo, edges } = result;
        if (!edges) {
          setLoading(false);

          return;
        }

        const segments = edges.reduce((acum, segment) => ({ ...acum, [segment.identifier]: segment }), {});
        setData({
          cursor: pageInfo.nextCursor,
          hasNextPage: pageInfo.hasNextPage,
          segments: more ? { ...data.segments, segments } : segments
        });
        setLoading(false);
      }
    },
    [data, segmentsFetch]
  );

  const fetchDebounce = useMemo(() => debounce(fetch, 500), [fetch]);

  useEffect(() => {
    fetch('');
  }, []);

  const handleRefresh = useCallback(
    (identifier, segment) => {
      setData(state => {
        const { segments } = state;
        if (!segments[identifier]) {
          return state;
        }

        if (!segment) {
          return { ...state, segments: omit(segments, [identifier]) };
        }

        return { ...state, segments: { ...segments, [identifier]: segment } };
      });
    },
    [filter]
  );

  const handleChange = useCallback(
    value => {
      setFilter(value);
      fetchDebounce(value);
    },
    [setFilter]
  );

  const handleClickAddSegment = useCallback(async () => {
    const response = await showModal(
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
      segmentAddMutation(name, description);
      fetchDebounce(filter);
    }
  }, [showModal, segmentAddMutation, filter]);

  const { segments } = data;

  return (
    <Flex direction="column" gap={2} className="segments w-full">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleClickAddSegment} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          New Segment
        </Button>
        <Input placeholder="Search" value={filter} onChange={handleChange} label="">
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </Flex>
      <div className="mt-2 h-px bg-gray-200" />
      <Flex direction="column">
        {!loading &&
          segments &&
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
