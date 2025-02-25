import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const Message = ({ messageType, message }) => {
  return (
    <div
      className={`p-4 rounded-3xl text-[14px] shadow-xs flex flex-col gap-3 ${
        messageType === "ai"
          ? "bg-gray-100 w-9/10"
          : "bg-black text-white w-fit max-w-9/10 ml-auto break-words"
      }`}
    >
      {messageType === "ai" && (
        <div className="flex items-center gap-3 font-medium">
          {/* <img src="/centonislogov2.png" alt="message-logo" className="h-4" /> */}
          <span className = 'bg-black py-1 px-2 rounded-lg text-sm text-white'>Bot</span>
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message}</ReactMarkdown>
    </div>
  );
};

export default Message;
