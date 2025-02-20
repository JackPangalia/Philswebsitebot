import ReactMarkdown from 'react-markdown'
import remarkGfm from "remark-gfm";

const Message = ({ messageType, message }) => {
  return (
    <div
      className={`p-4 rounded-3xl text-[14.5px] ${
        messageType === "ai"
          ? "bg-gray-100 w-9/10"
          : "bg-black text-white w-fit max-w-9/10 ml-auto break-words"
      }`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message}</ReactMarkdown>
    </div>
  );
};

export default Message;