import AudienceFacts from '../../VisitorTab/components/AudienceFacts';
import PageReads from '../../VisitorTab/components/PageReads';
import VisitorPicker from '../../VisitorTab/components/VisitorPicker';

/** Who the preview's visitor is: signed in as whom, their device, language and first visit, and what the page reads. */
const VisitorPane = () => (
  <div className="flex flex-col gap-3">
    <section className="flex flex-col gap-1.5">
      <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">Signed in as</h6>
      <VisitorPicker />
    </section>
    <AudienceFacts />
    <PageReads />
  </div>
);

export default VisitorPane;
