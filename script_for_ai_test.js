// Initialize Socket.IO connection
// const socket = io("https://stark-peak-51024-a84cb77499f2.herokuapp.com/");
const socket = io("http://localhost:3001");

// UI Elements
const messageArea = document.getElementById("chatbot-message-area");
const chatInput = document.getElementById("chatbot-input");
const sendButton = document.getElementById("send-btn");
const chatbotContainer = document.getElementById("chatbot-container");
const closeChatbotBtn = document.getElementById("close-chatbot-btn");
const openChatbotBtn = document.getElementById("open-chatbot-btn");

// Current message being streamed
let currentMessageDiv = null;
let currentMessage = "";
let loadingDiv = null;
let propertyBuffer = "";
let isInsideProperty = false;
let propertyLoadingDiv = null;
let tagBuffer = "";
let wholeTagBuffer = "";
let wholeMessage = "";

// Chat history management
const STORAGE_KEY = "chatHistory";

// Function to add intro message
function addIntroMessage() {
  const label = document.createElement("p");
  label.className = "chatbot-label";
  label.textContent = "AI chatbot";

  const intro = document.createElement("p");
  intro.className = "chatbot-message";
  intro.innerHTML = `Hello! 😊 I'm your virtual assistant here to help with all things real
              estate for Phil Moore and Doris Gee. Whether you're searching for a
              home, have questions about the buying or selling process, or just need
              some guidance, I'm here for you! Let me know how I can assist, and
              I'll do my best to find exactly what you're looking for`;

  messageArea.appendChild(label);
  messageArea.appendChild(intro);
  saveChatHistory();
}

// Function to save chat history
function saveChatHistory() {
  const messages = Array.from(messageArea.children)
    .filter((element) => element.id !== "centonis-badge")
    .map((element) => ({
      type: element.className,
      content: element.innerHTML,
    }));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// Function to load chat history
function loadChatHistory() {
  const savedHistory = sessionStorage.getItem(STORAGE_KEY);
  if (savedHistory) {
    const messages = JSON.parse(savedHistory);
    messages.forEach((message) => {
      const messageDiv = document.createElement("div");
      messageDiv.className = message.type;
      messageDiv.innerHTML = message.content;
      messageArea.appendChild(messageDiv);
    });
    messageArea.scrollTop = messageArea.scrollHeight;
  } else {
    // Only add intro message if there's no chat history
    addIntroMessage();
  }
}

// Load chat history when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadChatHistory();
});

let isRefreshing = false;
let closeTimer;

// Open/Close the chatbot and update button text
openChatbotBtn.addEventListener("click", () => {
  if (chatbotContainer.style.display === "block") {
    chatbotContainer.style.display = "none";
    openChatbotBtn.innerHTML = `AI Chatbot
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" id="open-icon">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
      
    `;
  } else {
    chatbotContainer.style.display = "block";
    messageArea.scrollTop = messageArea.scrollHeight;
    openChatbotBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    `;
  }
});

// Close the chatbot
closeChatbotBtn.addEventListener("click", () => {
  chatbotContainer.style.display = "none";
});

function showLoading() {
  loadingDiv = document.createElement("div");
  loadingDiv.className = "chatbot-message";
  loadingDiv.innerHTML = "<div class='loader'></div>";
  messageArea.appendChild(loadingDiv);
  messageArea.scrollTop = messageArea.scrollHeight;
}

function removeLoading() {
  if (loadingDiv) {
    loadingDiv.remove();
    loadingDiv = null;
  }
}

function showPropertyLoading() {
  propertyLoadingDiv = document.createElement("div");
  propertyLoadingDiv.className = "chatbot-message";
  propertyLoadingDiv.innerHTML = "<div class='loader'></div>";
  currentMessageDiv.appendChild(propertyLoadingDiv);
  messageArea.scrollTop = messageArea.scrollHeight;
}

function removePropertyLoading() {
  if (propertyLoadingDiv) {
    propertyLoadingDiv.remove();
    propertyLoadingDiv = null;
  }
}

function appendUserMessage(message) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "user-message";
  messageDiv.textContent = message;
  messageArea.appendChild(messageDiv);
  messageArea.scrollTop = messageArea.scrollHeight;
  saveChatHistory(); // Save after adding user message
}

function startNewAIMessage() {
  removeLoading();
  const chatbotLabel = document.createElement("p");
  chatbotLabel.className = "chatbot-label";
  chatbotLabel.textContent = "AI chatbot";
  messageArea.appendChild(chatbotLabel);

  currentMessageDiv = document.createElement("div");
  currentMessageDiv.className = "chatbot-message";
  messageArea.appendChild(currentMessageDiv);
  currentMessage = "";
  propertyBuffer = "";
  isInsideProperty = false;
  tagBuffer = "";
}

function processCharacter(char) {
  tagBuffer += char;
  wholeTagBuffer += char;
  if (tagBuffer.length > 20) {
    tagBuffer = tagBuffer.slice(-20);
  }

  if (tagBuffer.includes("<property>")) {
    isInsideProperty = true;
    showPropertyLoading();
    tagBuffer = "";
    return true;
  }

  if (tagBuffer.includes("</property>")) {
    isInsideProperty = false;
    removePropertyLoading();
    tagBuffer = "";
    return true;
  }

  return false;
}

function updateAIMessage(text) {
  for (let char of text) {
    const tagFound = processCharacter(char);
    currentMessage += char;
  }

  if (!isInsideProperty) {
    currentMessageDiv.innerHTML = formatAIResponse(currentMessage);
    messageArea.scrollTop = messageArea.scrollHeight;
    saveChatHistory(); // Save after updating AI message
  }
}

// Socket.IO event listeners
socket.on("textCreated", () => {
  startNewAIMessage();
});

socket.on("textDelta", (data) => {
  if (data.textDelta.value) {
    updateAIMessage(data.textDelta.value);
  }
});

socket.on("quickReplies", (quickReplyJSON) => {
  const quickReplies = JSON.parse(quickReplyJSON);
  const quickRepliesDiv = document.createElement("div");
  quickRepliesDiv.className = "quick-replies-container";

  const quickReplyList = document.createElement("ul");
  quickReplyList.className = "quick-replies-list";

  quickReplies.smart_replies.forEach((reply) => {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.className = "quick-reply-button";
    button.textContent = reply;

    button.addEventListener("click", () => {
      appendUserMessage(reply);
      showLoading();
      socket.emit("send_prompt", { prompt: reply });
      quickRepliesDiv.remove();
    });

    listItem.appendChild(button);
    quickReplyList.appendChild(listItem);
  });

  quickRepliesDiv.appendChild(quickReplyList);
  messageArea.appendChild(quickRepliesDiv);
  messageArea.scrollTop = messageArea.scrollHeight;
  saveChatHistory(); // Save after adding quick replies
});

socket.on("codeInterpreterInput", (input) => {
  updateAIMessage("\n```\n" + input + "\n```\n");
});

socket.on("codeInterpreterLogs", (logs) => {
  updateAIMessage("\nOutput:\n```\n" + logs + "\n```\n");
});

// Format AI response (updated as per user requests)
// formatAIResponse fucntion declartion (Code will be added)

// Function to clear smart suggestions
function clearSmartSuggestions() {
  const quickRepliesDiv = document.querySelector(".quick-replies-container");
  if (quickRepliesDiv) {
    quickRepliesDiv.remove();
  }
}

// Send message handler
sendButton.addEventListener("click", () => {
  const message = chatInput.value.trim();
  if (!message || loadingDiv) return; // Prevent sending if loading
  appendUserMessage(message);
  showLoading();
  socket.emit("send_prompt", { prompt: message });
  chatInput.value = "";
  clearSmartSuggestions(); // Clear smart suggestions on message send
});

// Handle enter key
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendButton.click();
  }
});

socket.on("connect", () => {
  let currentSessionId = sessionStorage.getItem("chatSessionId");
  if (currentSessionId) {
    socket.emit("resume_session", { sessionId: currentSessionId });
  } else {
    socket.emit("init_session");
  }
});

// Add these socket listeners after other socket.on handlers
socket.on("session_created", (data) => {
  currentSessionId = data.sessionId;
  sessionStorage.setItem("chatSessionId", currentSessionId);
});

socket.on("error", (data) => {
  console.error("Chatbot error:", data.message);
  // Optionally display error to user
  const errorDiv = document.createElement("div");
  errorDiv.className = "chatbot-message error";
  errorDiv.textContent =
    "There was an error with the chat session. Please refresh the page.";
  messageArea.appendChild(errorDiv);
});

// Add this socket listener after your other socket.on handlers
socket.on("clear_chat", (data) => {
  if (data.sessionId === currentSessionId) {
    // Clear all messages except the Centonis badge
    const centonisBadge = document.getElementById("centonis-badge");
    messageArea.innerHTML = "";
    messageArea.appendChild(centonisBadge);

    // Add intro message back
    addIntroMessage();

    // Clear the session ID from storage
    sessionStorage.removeItem("chatSessionId");
    currentSessionId = null;

    // Initialize a new session
    socket.emit("init_session");
  }
});