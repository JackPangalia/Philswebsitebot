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
  const messagesEndRef = useRef(null);

  // Load messages from sessionStorage on initial render
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('chatMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
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
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.messageType === 'ai' && !lastMessage.complete) {
          // Update the last AI message
          const updatedMessages = [...prev];
          updatedMessages[prev.length - 1] = {
            ...lastMessage,
            message: lastMessage.message + textDelta.value
          };
          return updatedMessages;
        } else {
          // Start a new AI message
          return [...prev, {
            messageType: 'ai',
            message: textDelta.value,
            complete: false
          }];
        }
      });
    });

    newSocket.on('responseComplete', () => {
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
      // Add error handling UI as needed
    });

    newSocket.on('clear_chat', ({ sessionId: clearedSessionId }) => {
      if (clearedSessionId === sessionId) {
        setMessages([]);
        sessionStorage.removeItem('chatMessages');
        sessionStorage.removeItem('chatSessionId');
      }
    });

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    // Add user message to chat
    const newMessage = {
      messageType: 'user',
      message: inputMessage,
      complete: true
    };
    
    setMessages(prev => [...prev, newMessage]);

    // Send message to server
    socket.emit('send_prompt', { prompt: inputMessage });
    setInputMessage('');
  };

  // Add a clear chat function
  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem('chatMessages');
    sessionStorage.removeItem('chatSessionId');
  };

  return (
    <div className="bg-gray-50 w-full h-screen">
      <div className="absolute bottom-16 right-4">
        <div className="rounded-2xl h-[675px] w-[400px] shadow-sm bg-white">
          {/* Chat area */}
          <div className="h-[91%] flex flex-col gap-4 overflow-y-auto px-5 pt-5">
            {messages.map((msg, index) => (
              <Message
                key={index}
                messageType={msg.messageType}
                message={msg.message}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input field */}
          <form 
            onSubmit={handleSendMessage}
            className="mx-5 shadow-sm border-2 border-zinc-100 p-1 rounded-4xl flex justify-between focus-within:border-black"
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
              disabled={!inputMessage.trim()}
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