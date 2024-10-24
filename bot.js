// Impots
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
    "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",
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

//! ----- (BELOW) SOCKET.IO CODE RELATED TO GENERATING THE RESPONSE AND STREAMING THE RESPONE BACK TO THE FROTNEND ------- !//
// AI response genreation code
io.on("connection", (socket) => {
  socket.on("send_prompt", (data) => {
    const prompt = data.prompt;

    const generateReponse = async () => {
      await retrieveAssistant()
      await initializeThread()

      const message = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: prompt,
      });

      openai.beta.threads.runs
        .stream(threadId, {
          assistant_id: assistant.id,
        })
        .on("textCreated", (text) => socket.emit('textCreated', text))
        .on("textDelta", (textDelta, snapshot) =>
          socket.emit('textDelta', { textDelta, snapshot})
        )
        .on("toolCallCreated", (toolCall) =>
          socket.emit('toolCallCreated', toolCall)
        )
        .on("toolCallDelta", (toolCallDelta, snapshot) => {
          if (toolCallDelta.type === "code_interpreter") {
            if (toolCallDelta.code_interpreter.input) {
              socket.emit('codeInterpreterInput', toolCallDelta.code_interpreter.input);
            }
            if (toolCallDelta.code_interpreter.outputs) {
              toolCallDelta.code_interpreter.outputs.forEach((output) => {
                if (output.type === "logs") {
                  socket.emit('codeInterpreterLogs', output.logs);
                }
              });
            }
          }
        })
        .on("end", () => {
          socket.emit('responseComplete');
        });
    };

    generateReponse();
  });
});

//! ----- (ABOVE) SOCKET.IO CODE RELATED TO GENERATING THE RESPONSE AND STREAMING THE RESPONE BACK TO THE FROTNEND ------- !//
// Start the server
server.listen(port, () => {
  console.log(`Server running on http://localhost:3000`);
});
