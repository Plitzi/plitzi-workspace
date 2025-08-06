import Markdown from '@plitzi/plitzi-ui/Markdown';

export type MessageTextProps = {
  content?: string;
};

const MessageText = ({ content = '' }) => {
  return <Markdown className="text-sm">{content}</Markdown>;
};

export default MessageText;
