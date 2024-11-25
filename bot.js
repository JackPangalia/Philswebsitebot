// IMPORTS
import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import fs from "fs";
import cron from "node-cron";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

// Create an Express app
const app = express();
const port = 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

app.use(cors());

// Define the openai client
const openai = new OpenAI({
  apiKey:
    "",
});

// Null values of the threadId and assistant yet to be created (These varibles will be populated with the respected values)
let threadId = null;
let assistant = null;

// Define assistant ID
const assistantId = "asst_bwx7JzTMDI0T8Px1cgnzNh8a";

// Retrieve the assistant by ID //TODO: consider using parameter for "ID"
const retrieveAssistant = async () => {
  try {
    if (!assistant) {
      assistant = await openai.beta.assistants.retrieve(assistantId);
      console.log("Assistant retrieved");
    }
  } catch (error) {
    console.error("There was an error retrieving Assistant ", error);
  }
};

// Function to create thread
const initializeThread = async () => {
  try {
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      console.log("Thread created");
    }
  } catch (error) {
    console.error("Error creating thread ", error);
  }
};

const smartReply = async (message) => {
  const completions = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    max_tokens: 150,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `You are a professional smart reply system for a real estate chatbot. Your job is to generate three concise, actionable, and general replies in the following JSON format:

{
  "smart_replies": [
    "Closely related reply here.",
    "Tangentially related reply here.",
    "Completely different topic reply here."
  ]
}

### Rules:
1. **General Responses Only:** Replies must remain high-level and actionable. Avoid niche or overly specific suggestions.  
   - Example: Instead of "Consider property management options," suggest, "How can I make property investments?"  
2. **Closely Related Reply:** Respond directly to the main topic but keep it broad and actionable.  
3. **Tangential Reply:** Suggest a loosely connected but general topic of interest.  
4. **Different Real Estate Topic:** Offer a suggestion from a completely unrelated general topic. Avoid overlap with the message subject.

### Guidelines:
- All replies must be conversational, professional, and mimic real user intents.
- Avoid vague or abstract replies like "consider property management."
- Replies must be general and suitable for a diverse audience, avoiding detailed or niche topics.

### Example:
**Input:**  
"I'm interested in houses for sale in Burnaby."

**Output:**  
{
  "smart_replies": [
    "Show me houses available in Burnaby.",
    "What are the best neighborhoods in Burnaby?",
    "Can you explain the home-buying process?"
  ]
}

**Input:**  
"I want to learn about property investments."

**Output:**  
{
  "smart_replies": [
    "What types of properties are best for investment?",
    "Can I get tips on rental income?",
    "How does the home-buying process work?"
  ]
}`,
      },
      {
        role: "user",
        content: `${message}`,
      },
    ],
  });

  return completions.choices[0].message.content;
};


// Add these after other const declarations
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const sessions = new Map();

// Add this function to manage sessions
const createSession = () => {
  const sessionId = uuidv4();
  const session = {
    threadId: null,
    lastActive: Date.now(),
    timeoutId: null,
  };
  sessions.set(sessionId, session);
  return sessionId;
};

// Add function to cleanup sessions
const cleanupSession = async (sessionId) => {
  const session = sessions.get(sessionId);
  if (session && session.threadId) {
    try {
      await openai.beta.threads.del(session.threadId);
      console.log(
        `Thread ${session.threadId} deleted for session ${sessionId}`
      );
      // Emit an event to clear messages for this session
      io.emit("clear_chat", { sessionId });
    } catch (error) {
      console.error(`Error deleting thread for session ${sessionId}:`, error);
    }
  }
  sessions.delete(sessionId);
};

//! ----- (BELOW) SOCKET.IO CODE RELATED TO GENERATING THE RESPONSE AND STREAMING THE RESPONE BACK TO THE FROTNEND ------- !//
// AI response genreation code
io.on("connection", (socket) => {
  let sessionId = null;

  socket.on("init_session", () => {
    sessionId = createSession();
    socket.emit("session_created", { sessionId });
  });

  socket.on("resume_session", (data) => {
    if (data.sessionId && sessions.has(data.sessionId)) {
      sessionId = data.sessionId;
      const session = sessions.get(sessionId);
      session.lastActive = Date.now();

      // Clear existing timeout if any
      if (session.timeoutId) {
        clearTimeout(session.timeoutId);
      }

      // Set new timeout
      session.timeoutId = setTimeout(() => {
        cleanupSession(sessionId);
      }, SESSION_TIMEOUT);
    } else {
      sessionId = createSession();
      socket.emit("session_created", { sessionId });
    }
  });

  socket.on("send_prompt", async (data) => {
    if (!sessionId || !sessions.has(sessionId)) {
      socket.emit("error", { message: "Invalid session" });
      return;
    }

    const session = sessions.get(sessionId);
    session.lastActive = Date.now();

    // Clear existing timeout if any
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }

    const prompt = data.prompt;
    let fullResponse = "";

    const generateResponse = async () => {
      await retrieveAssistant();

      // Use existing thread ID from session or create new one
      if (!session.threadId) {
        const thread = await openai.beta.threads.create();
        session.threadId = thread.id;
      }

      const message = await openai.beta.threads.messages.create(
        session.threadId,
        {
          role: "user",
          content: prompt,
        }
      );

      openai.beta.threads.runs
        .stream(session.threadId, {
          assistant_id: assistant.id,
        })
        .on("textCreated", (text) => {
          socket.emit("textCreated", text);
        })
        .on("textDelta", (textDelta, snapshot) => {
          fullResponse += textDelta.value; // Append each chunk to fullResponse
          socket.emit("textDelta", { textDelta, snapshot });
        })
        .on("toolCallCreated", (toolCall) => {
          socket.emit("toolCallCreated", toolCall);
        })
        .on("toolCallDelta", (toolCallDelta, snapshot) => {
          if (toolCallDelta.type === "code_interpreter") {
            if (toolCallDelta.code_interpreter.input) {
              socket.emit(
                "codeInterpreterInput",
                toolCallDelta.code_interpreter.input
              );
            }
            if (toolCallDelta.code_interpreter.outputs) {
              toolCallDelta.code_interpreter.outputs.forEach((output) => {
                if (output.type === "logs") {
                  socket.emit("codeInterpreterLogs", output.logs);
                }
              });
            }
          }
        })
        .on("end", async () => {
          socket.emit("responseComplete");
          const quickReplyJSON = await smartReply(fullResponse);
          socket.emit("quickReplies", quickReplyJSON);

          // Set new timeout after response is complete
          session.timeoutId = setTimeout(() => {
            cleanupSession(sessionId);
          }, SESSION_TIMEOUT);
        });
    };

    generateResponse();
  });

  socket.on("disconnect", async () => {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        // Don't delete immediately on disconnect, let the timeout handle it
        session.timeoutId = setTimeout(() => {
          cleanupSession(sessionId);
        }, SESSION_TIMEOUT);
      }
    }
  });
});

//! ----- (ABOVE) SOCKET.IO CODE RELATED TO GENERATING THE RESPONSE AND STREAMING THE RESPONE BACK TO THE FROTNEND ------- !//
// Start the server
server.listen(port, () => {
  console.log(`Server running on http://localhost:3000`);
});
