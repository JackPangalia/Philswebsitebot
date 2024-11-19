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
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a smart reply system. You will be provided a message, generate 3 very short (5-10 word) potential prompts to this message in the below JSON format:

Example:
Input: Hello! 😊 I'm your assistant for Phil Moore and Doris Gee, here to help you with any real estate questions, buying or selling properties, and property searches in Burnaby, Vancouver, Richmond, and Coquitlam. How can I assist you today?

Output:
{
  "smart_replies": [
    "Explain the selling process",
    "Show me a spiciest house in Burnaby",
    "Is now a good time to buy a house in Vancouver" 
  ]
}
`,
      },
      {
        role: "user",
        content: `${message}`,
      },
    ],
  });

  // console.log("message: ", completions.choices[0].message);
  return completions.choices[0].message.content;
};

//! ----- (BELOW) SOCKET.IO CODE RELATED TO GENERATING THE RESPONSE AND STREAMING THE RESPONE BACK TO THE FROTNEND ------- !//
// AI response genreation code
io.on("connection", (socket) => {
  let currentThreadId = null;

  socket.on('session_end', (data) => {
    console.log('data, ', data)
  })

  socket.on("send_prompt", (data) => {
    const prompt = data.prompt;
    let fullResponse = ""; // Variable to store the entire response

    const generateReponse = async () => {
      await retrieveAssistant();
      await initializeThread();
      currentThreadId = threadId; // Store the thread ID

      const message = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: prompt,
      });

      openai.beta.threads.runs
        .stream(threadId, {
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
          console.log("Full Response:", fullResponse); // Log the stored response or use it as needed
          const quickReplyJSON = await smartReply(fullResponse);
          console.log(quickReplyJSON);
          socket.emit("quickReplies", quickReplyJSON);

          // You can now use fullResponse in the backend as required
        });
    };

    generateReponse();

    // try {
    //   console.log('disconnecting')
    //   if (currentThreadId) {
    //     // Delete the thread on socket disconnect as a backup
    //     await openai.beta.threads.del(currentThreadId);
    //     console.log(`Thread ${currentThreadId} deleted on disconnect`);
    //     currentThreadId = null;
    //     threadId = null; // Reset the global threadId
    //   }
    // } catch (error) {
    //   console.error("Error cleaning up thread on disconnect:", error);
    // }
  });
});

//! ----- (ABOVE) SOCKET.IO CODE RELATED TO GENERATING THE RESPONSE AND STREAMING THE RESPONE BACK TO THE FROTNEND ------- !//
// Start the server
server.listen(port, () => {
  console.log(`Server running on http://localhost:3000`);
});
