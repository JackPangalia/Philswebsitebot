import "./App.css";
import Send from "./Icons/Send";
import Message from "./components/Message";
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load messages from sessionStorage and remove incomplete messages
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('chatMessages');
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      const completeMessages = parsedMessages.filter(msg => msg.complete);
      setMessages(completeMessages);
      sessionStorage.setItem('chatMessages', JSON.stringify(completeMessages));
    }
  }, []);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  // Connect to Socket.IO server when component mounts
  useEffect(() => {
    const newSocket = io('http://localhost:3001'); // Adjust port as needed
    setSocket(newSocket);

    // Initialize or resume session
    const savedSessionId = sessionStorage.getItem('chatSessionId');
    if (savedSessionId) {
      newSocket.emit('resume_session', { sessionId: savedSessionId });
    } else {
      newSocket.emit('init_session');
    }

    // Socket event listeners
    newSocket.on('session_created', (data) => {
      setSessionId(data.sessionId);
      sessionStorage.setItem('chatSessionId', data.sessionId);
    });

    newSocket.on('textDelta', ({ textDelta, snapshot }) => {
      setIsLoading(false); // Hide loading when streaming starts
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.messageType === 'ai' && !lastMessage.complete) {
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = {
            ...lastMessage,
            message: lastMessage.message + textDelta.value
          };
          return updatedMessages;
        } else {
          return [...prev, {
            messageType: 'ai',
            message: textDelta.value,
            complete: false
          }];
        }
      });
    });

    newSocket.on('responseComplete', () => {
      setIsLoading(false);
      setMessages(prev => {
        const updatedMessages = [...prev];
        if (updatedMessages.length > 0) {
          updatedMessages[updatedMessages.length - 1] = {
            ...updatedMessages[updatedMessages.length - 1],
            complete: true
          };
        }
        return updatedMessages;
      });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setIsLoading(false);
    });

    newSocket.on('clear_chat', ({ sessionId: clearedSessionId }) => {
      if (clearedSessionId === sessionId) {
        setMessages([]);
        setIsLoading(false);
        sessionStorage.removeItem('chatMessages');
        sessionStorage.removeItem('chatSessionId');
      }
    });

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto-scroll to bottom when messages update or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    const newMessage = {
      messageType: 'user',
      message: inputMessage,
      complete: true
    };
    
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    // Send message to server
    socket.emit('send_prompt', { prompt: inputMessage });
    setInputMessage('');
  };

  return (
    <div className="bg-gray-50 w-full h-screen">
      <div className="absolute bottom-16 right-4">
        <div className="rounded-2xl h-[675px] w-[400px] shadow-sm bg-white p-5">
          {/* Chat area */}
          <div className="h-[92%] flex flex-col gap-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <Message
                key={index}
                messageType={msg.messageType}
                message={msg.message}
              />
            ))}
            {isLoading && (
              <div className="text-gray-500 italic px-4">Loading...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input field */}
          <form 
            onSubmit={handleSendMessage}
            className="shadow-sm border-2 border-zinc-100 p-1 rounded-4xl flex justify-between focus-within:border-black"
          >
            <input
              className="outline-none w-[90%] px-4"
              placeholder="Ask a question..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
            />
            <button 
              type="submit"
              className="hover:cursor-pointer"
              disabled={!inputMessage.trim() || isLoading}
            >
              <Send />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
