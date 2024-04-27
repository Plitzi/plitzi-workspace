// Packages
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import omit from 'lodash/omit';
import debounce from 'lodash/debounce';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Relatives
import SegmentsContext from './SegmentsContext';
import Segment from './Segment';
import SegmentForm from './Models/SegmentForm';

/**
 * @param {{}} props
 * @returns {React.ReactElement}
 */
const Segments = () => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ name: { contains: '' } });
  const [data, setData] = useState({ cursor: undefined, hasNextPage: false, segments: {} });
  const { showModal } = useModal();
  const { segmentsFetch, segmentAddMutation } = useContext(SegmentsContext);

  const fetch = async (search, more = false) => {
    setLoading(true);
    const result = await segmentsFetch(search, data.cursor, 20);
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
  };

  const fetchDebounce = useRef(debounce(fetch, 350));

  useEffect(() => {
    fetch({ name: { contains: '' } });
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
    e =>
      setFilter(state => {
        const newFilter = { ...state, name: { contains: e.target.value } };
        fetchDebounce.current(newFilter);

        return newFilter;
      }),
    [setFilter]
  );

  const handleClickAddSegment = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Segment</h4>
      </Modal.Header>,
      <Modal.Body>
        <SegmentForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name, description }
      } = response;
      segmentAddMutation(name, description);
      fetchDebounce.current(filter);
    }
  }, [showModal, handleRefresh, segmentAddMutation, filter]);

  const { segments } = data;

  return (
    <div className="segments flex flex-col">
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickAddSegment}
        className="rounded-none px-4 py-3 bg-gray-600 text-white"
      >
        <i className="fa-solid fa-puzzle-piece fa-2x mr-4 text-white" />
        Add Segment
      </Button>
      <div className="px-4 my-2">
        <FormControl value={filter.name.contains} type="text" placeholder="Search Segments" onChange={handleChange} />
      </div>
      <div className="flex flex-col px-4 my-2">
        {!loading &&
          segments &&
          Object.values(segments).map((segment, key) => {
            const {
              id,
              identifier,
              definition: { name, description }
            } = segment;

            return (
              <Segment
                key={key}
                id={id}
                identifier={identifier}
                name={name}
                description={description}
                onParentRefresh={handleRefresh}
              />
            );
          })}
      </div>
    </div>
  );
};

export default Segments;
