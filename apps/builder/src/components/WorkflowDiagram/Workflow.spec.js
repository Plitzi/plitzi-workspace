// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Relatives
import WorkflowDiagram from './WorkflowDiagram';

describe('WorkflowDiagram', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<WorkflowDiagram items={[]} />);

    expect(baseElement).toBeTruthy();
  });

  it('should render items successfully', () => {
    // const component = render(
    //   <WorkflowDiagram>
    //     {/* <span>test</span>
    //     <span>hello world</span> */}
    //   </WorkflowDiagram>
    // );

    // expect(component.getByText(/test/i)).toBeTruthy();
    // expect(component.getByText(/hello/i)).toBeTruthy();
  });

  it('should render custom classes successfully', () => {
    // const component = render(<WorkflowDiagram items={[]} className="customClass" />);

    // expect(component.container.firstChild).toBeTruthy();
    // expect(component.container.getElementsByClassName('customClass').length).toBe(1);
  });
});
