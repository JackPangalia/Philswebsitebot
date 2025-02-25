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
// Track current message state
let isGenerating = false;
let currentRunId = null;
// Chat history management
const STORAGE_KEY = "chatHistory";
// Function to add intro message
function addIntroMessage() {
  const label = document.createElement("p");
  label.className = "chatbot-label";
  label.textContent = "AI chatbot";
  const intro = document.createElement("p");
  intro.className = "chatbot-message";
  intro.innerHTML = `Welcome to phils bot`;
  messageArea.appendChild(label);
  messageArea.appendChild(intro);
  saveChatHistory();
}
// Function to save chat history
function saveChatHistory() {
  const messages = Array.from(messageArea.children)
    .filter((element) => {
      return (
        element.id !== "centonis-badge" &&
        (!isGenerating || element !== currentMessageDiv)
      );
    })
    .map((element) => ({
      type: element.className,
      content: element.innerHTML,
      runId: element.dataset.runId,
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
  chatbotLabel.dataset.runId = currentRunId;

  currentMessageDiv = document.createElement("div");
  currentMessageDiv.className = "chatbot-message";
  currentMessageDiv.dataset.runId = currentRunId;

  messageArea.appendChild(chatbotLabel);
  messageArea.appendChild(currentMessageDiv);
  currentMessage = "";
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

socket.on("responseComplete", (data) => {
  isGenerating = false;
  currentRunId = null;
  saveChatHistory();
});

// Socket.IO event listeners
socket.on("textCreated", () => {
  isGenerating = true;
  currentRunId = data.runId;
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
function formatAIResponse(response) {
  const lines = response.split("\n");
  let formattedResponse = "";
  let inList = false;
  let inProperty = false;
  let propertyContent = "";
  let propertyDetails = "";
  let propertyImage = "";
  let listingLink = "";
  let price = "";
  let address = "";

  for (let line of lines) {
    // Replace bold text with semibold
    line = line.replace(/\*\*(.*?)\*\*/g, "<span class='semibold'>$1</span>");

    if (line.trim().startsWith("###")) {
      if (inList) {
        formattedResponse += "</ul>";
        inList = false;
      }
      const headingText = line.trim().substring(3).trim();
      formattedResponse += `<h4>${headingText}</h4>`; // Changed to <h4> for smaller titles
      continue;
    }

    if (line.trim() === "<property>") {
      inProperty = true;
      propertyContent = "<div class='property'>";
      propertyDetails = "<div class='property-details'>";
    } else if (line.trim() === "</property>") {
      inProperty = false;
      propertyContent +=
        '<div class="image-container">' +
        propertyImage +
        "</div>" +
        price +
        propertyDetails +
        "</div>" +
        `<p class="address">${address}</p>` +
        listingLink +
        "</div>";
      formattedResponse += propertyContent;
      propertyContent = "";
      propertyDetails = "";
      propertyImage = "";
      listingLink = "";
      price = "";
      address = "";
    } else if (inProperty) {
      if (line.startsWith("Price:")) {
        price = `<p class="price">${line.trim()}</p>`;
      } else if (line.startsWith("Address:")) {
        address = line.replace("Address:", "").trim();
      } else if (line.startsWith("Bedrooms:")) {
        propertyDetails += `<p class="bedrooms">${line.trim()}</p>`;
      } else if (line.startsWith("Bathrooms:")) {
        propertyDetails += `<p class="bathrooms">${line.trim()}</p>`;
      } else if (line.startsWith("[View Listing]")) {
        const match = line.match(/\[View Listing\]\((.*?)\)/);
        if (match) {
          listingLink = `<a href="${match[1]}" class="view-listing">View Listing</a>`;
        }
      } else if (line.startsWith("![Image]")) {
        const match = line.match(/!\[Image\]\((.*?)\)/);
        if (match) {
          propertyImage = `<img src="${match[1]}" alt="Property Image" class="property-image">`;
        }
      }
    } else if (line.trim().startsWith("-")) {
      if (!inList) {
        formattedResponse += "<ul>"; // Keep lists non-indented by ensuring no additional styles are applied
        inList = true;
      }
      formattedResponse += "<li>" + line.trim().substring(1).trim() + "</li>";
    } else {
      if (inList) {
        formattedResponse += "</ul>";
        inList = false;
      }
      line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      formattedResponse += line + "<br>";
    }
  }

  if (inList) {
    formattedResponse += "</ul>";
  }

  return formattedResponse;
}
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
