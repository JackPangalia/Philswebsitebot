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

// Local storage key for chatbot state
const CHATBOT_STATE_KEY = "chatbotState";

// Function to add intro message
function addIntroMessage() {
  const label = document.createElement("p");
  label.className = "chatbot-label";
  label.textContent = "AI chatbot";

  const intro = document.createElement("p");
  intro.className = "chatbot-message";
  intro.innerHTML = `Intro message`;

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

// Function to save chatbot state
function saveChatbotState(isOpen) {
  localStorage.setItem(CHATBOT_STATE_KEY, JSON.stringify(isOpen));
}

// Function to load chatbot state
function loadChatbotState() {
  const state = localStorage.getItem(CHATBOT_STATE_KEY);
  return state ? JSON.parse(state) : false;
}

// Toggle chatbot visibility and update state
function toggleChatbotVisibility() {
  const isCurrentlyOpen = chatbotContainer.style.display === "block";
  chatbotContainer.style.display = isCurrentlyOpen ? "none" : "block";
  openChatbotBtn.innerHTML = isCurrentlyOpen
    ? `Open`
    : `Close`;
  saveChatbotState(!isCurrentlyOpen);
}

// Load chat history and chatbot state on page load
document.addEventListener("DOMContentLoaded", () => {
  loadChatHistory();
  const isChatbotOpen = loadChatbotState();
  chatbotContainer.style.display = isChatbotOpen ? "block" : "none";
  openChatbotBtn.innerHTML = isChatbotOpen
    ? `Close`
    : `Open`;
});

// Open/Close chatbot button event listener
openChatbotBtn.addEventListener("click", toggleChatbotVisibility);
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
// formatAIResponse function to format AI response (add back later!)

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
