import Send from "./Icons/Send";
import Expand from "./Icons/Expand";
import Message from "./components/Message";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

function App() {
  // State variables
  const [messages, setMessages] = useState([]); // Array to store chat messages
  const [inputMessage, setInputMessage] = useState(""); // Current input message
  const [socket, setSocket] = useState(null); // Socket.IO client instance
  const [sessionId, setSessionId] = useState(null); // Unique session ID
  const [isLoading, setIsLoading] = useState(false); // Loading state indicator
  const [error, setError] = useState(null); // Error state
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false); // Session expired modal state
  const messagesEndRef = useRef(null); // Reference to the end of messages for scrolling
  const [isExpanded, setIsExpanded] = useState(false); // Expanded state for chat window

  // Load messages from sessionStorage on component mount
  useEffect(() => {
    const savedMessages = sessionStorage.getItem("chatMessages");
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // Filter out incomplete messages from the saved data.
        const completeMessages = parsedMessages.filter((msg) => msg.complete);
        setMessages(completeMessages);
        // Update sessionStorage with the filtered messages.
        sessionStorage.setItem(
          "chatMessages",
          JSON.stringify(completeMessages)
        );
      } catch (error) {
        console.error("Error parsing saved messages:", error);
        // Clear corrupted messages
        sessionStorage.removeItem("chatMessages");
      }
    }
  }, []);

  // Save messages to sessionStorage whenever the messages array changes
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("chatMessages", JSON.stringify(messages));
    }
  }, [messages]);

  // Connect to Socket.IO server and handle session initialization
  useEffect(() => {
    const newSocket = io("http://localhost:3001", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }); // Connect to the server with reconnection options
    setSocket(newSocket);

    // Attempt to resume a previous session or initialize a new one
    const savedSessionId = sessionStorage.getItem("chatSessionId");
    if (savedSessionId) {
      newSocket.emit("resume_session", { sessionId: savedSessionId });
    } else {
      newSocket.emit("init_session");
    }

    // Socket event listeners
    newSocket.on("session_created", (data) => {
      setSessionId(data.sessionId);
      sessionStorage.setItem("chatSessionId", data.sessionId);

      // If this was due to a cleared chat or expired session, clear the messages
      if (data.wasCleared || data.wasExpired) {
        setMessages([]);
        sessionStorage.removeItem("chatMessages");

        if (data.wasExpired) {
          setShowSessionExpiredModal(true);
        }
      }
    });

    newSocket.on("session_resumed", (data) => {
      setSessionId(data.sessionId);
      // Session was successfully resumed, no need to change the message state
    });

    // Handle incoming text deltas (streaming responses)
    newSocket.on("textDelta", ({ textDelta, snapshot }) => {
      setIsLoading(false); // Hide loading indicator when streaming starts
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        // If the last message is an incomplete AI message, append the new text
        if (
          lastMessage &&
          lastMessage.messageType === "ai" &&
          !lastMessage.complete
        ) {
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = {
            ...lastMessage,
            message: lastMessage.message + textDelta.value,
          };
          return updatedMessages;
        } else {
          // Otherwise, create a new AI message
          return [
            ...prev,
            {
              messageType: "ai",
              message: textDelta.value,
              complete: false,
            },
          ];
        }
      });
    });

    // Handle completion of an AI response
    newSocket.on("responseComplete", () => {
      setIsLoading(false);
      setMessages((prev) => {
        const updatedMessages = [...prev];
        if (updatedMessages.length > 0) {
          updatedMessages[updatedMessages.length - 1] = {
            ...updatedMessages[updatedMessages.length - 1],
            complete: true,
          };
        }
        return updatedMessages;
      });
    });

    // Handle socket errors
    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
      setIsLoading(false);
      setError(error.message || "An error occurred");

      // Show appropriate error message based on error code
      if (error.code === "SESSION_INVALID") {
        // Clear local session data and reinitialize
        sessionStorage.removeItem("chatSessionId");
        sessionStorage.removeItem("chatMessages");
        setMessages([]);

        // Try to initialize a new session after a brief delay
        setTimeout(() => {
          newSocket.emit("init_session");
        }, 1000);
      }

      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    });

    // Handle chat clearing events
    newSocket.on("clear_chat", ({ sessionId: clearedSessionId, reason }) => {
      if (clearedSessionId === sessionId) {
        setMessages([]);
        setIsLoading(false);
        sessionStorage.removeItem("chatMessages");

        if (reason === "session_timeout") {
          sessionStorage.removeItem("chatSessionId");
          setShowSessionExpiredModal(true);
        }
      }
    });

    // Handle reconnection events
    newSocket.on("connect", () => {
      // If we already have a session ID, try to resume it
      const currentSessionId = sessionStorage.getItem("chatSessionId");
      if (currentSessionId) {
        newSocket.emit("resume_session", { sessionId: currentSessionId });
      } else {
        newSocket.emit("init_session");
      }
    });

    // Cleanup when the component unmounts
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto-scroll to the bottom when messages or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle sending a message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    const newMessage = {
      messageType: "user",
      message: inputMessage,
      complete: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    // Send the message to the server
    socket.emit("send_prompt", { prompt: inputMessage });
    setInputMessage("");
  };

  // Handle clearing the chat
  const handleClearChat = () => {
    if (!socket || !sessionId) return;

    // Send clear_chat event to the server
    socket.emit("clear_chat", { sessionId });
  };

  // Handle dismissing the session expired modal
  const handleDismissSessionExpiredModal = () => {
    setShowSessionExpiredModal(false);
  };

  return (
    <div className="bg-gray-50 w-full h-screen flex items-center justify-center">
      <div
        className={`absolute bottom-16 right-4 
          ${
            isExpanded
              ? "w-[90vw] h-[90vh] max-w-[900px] max-h-[900px]"
              : "w-[90%] max-w-[400px] h-[80vh] max-h-[700px]"
          }
          rounded-2xl shadow-lg bg-white flex flex-col transition-all duration-300`}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center">
            <img
              src="/logo_placeholder.jpg"
              alt="logo"
              className="w-auto h-6"
            />
          </div>
          <div className="flex items-center space-x-2">
            {/* Clear Chat Button */}
            {messages.length > 0 && (
              <button
                className="text-sm text-gray-500 hover:text-red-500 hover:cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                onClick={handleClearChat}
                title="Clear chat history"
              >
                Clear
              </button>
            )}
            <button
              className="hover:text-gray-600 hover:cursor-pointer hover:bg-zinc-100 p-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Expand />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-2 text-sm">
            <p className="font-bold">Error</p>
            <p>{error} Refresh the page or try to send a message</p>
          </div>
        )}

        {/* Chat area (Messages) */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[4.3rem] space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
              <p>Start a new conversation</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <Message
              key={index}
              messageType={msg.messageType}
              message={msg.message}
            />
          ))}

          {isLoading && (
            <div className="flex items-center mt-2 text-gray-500">
              <div className="loader "></div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Input Field */}
        <div className="absolute bottom-0 left-4 right-4 z-10 bg-white h-[4rem] rounded-tl-4xl rounded-tr-4xl">
          <form
            onSubmit={handleSendMessage}
            className="shadow-xs border border-zinc-300 rounded-full flex items-center bg-white focus-within:border-black focus-within:border-2"
          >
            <input
              className="flex-1 outline-none px-4 py-1"
              placeholder="Ask a question..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
            />
            <button
              type="submit"
              className="py-1 px-2 hover:cursor-pointer"
              disabled={!inputMessage.trim() || isLoading}
            >
              <Send />
            </button>
          </form>
        </div>
      </div>

      {/* Session Expired Modal */}
      {showSessionExpiredModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-2">Session Expired</h3>
            <p className="mb-4">
              Your chat session has expired due to inactivity. A new session has
              been created for you.
            </p>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={handleDismissSessionExpiredModal}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
