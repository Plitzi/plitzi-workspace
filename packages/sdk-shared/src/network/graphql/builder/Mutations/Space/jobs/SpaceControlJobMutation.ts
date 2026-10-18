import type { SpaceJob } from '../../../../../../types';

export type TSpaceControlJobMutation = SpaceJob;

/** Pauses, resumes, cancels or runs again one of the space's jobs, and answers it as the queue now has it. */
const SpaceControlJobMutation = /* GraphQL */ `
  mutation SpaceControlJobMutation($jobId: String!, $control: String!) {
    SpaceControlJob(jobId: $jobId, control: $control) {
      id
      environment
      kind
      name
      trigger
      startedBy
      status
      progress
      step
      error
      attempts
      maxAttempts
      activeMs
      pauseRequested
      cancelRequested
      key
      missed
      dueAt
      createdAt
      updatedAt
    }
  }
`;

export default SpaceControlJobMutation;
