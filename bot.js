//! CODE CONTAINNG LISTINGS SCRAPING IS IN CHATGPT CHAT NAMED "schedule task at midnight" 

import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import fs from 'fs'
import cron from 'node-cron'
import express from 'express';
import cors from 'cors'


// Create an Express app
const app = express();
const port = 3000;

// Middleware to parse JSON and enable CORS
app.use(cors({
  origin: 'http://127.0.0.1:5500'
}))

app.use(express.json());


// Define the openai client
const openai = new OpenAI({
  apiKey: "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",
});

// Helper function to clean up text
const cleanText = (text) => text.replace(/\s+/g, " ").trim();

// Helper function to upload file to OpenAI (same as before)
const uploadFileToOpenAI = async (fileName) => {
  try {
    const file = await openai.files.create({
      file: fs.createReadStream(fileName),
      purpose: "assistants",
    });

    const myVectorStoreFile = await openai.beta.vectorStores.files.create(
      "vs_wjbc6c0aO6Rf6krRnQjWMjGF",
      {
        file_id: file.id,
      }
    );
    console.log(myVectorStoreFile);
  } catch (error) {
    console.error("Error uploading the file to OpenAI:", error);
  }
};

// Define assistant ID
const assistantId = "asst_bwx7JzTMDI0T8Px1cgnzNh8a";

// Retrieve the assistant by ID //TODO: consider using parameter for "ID"
const retrieveAssistant = async () => {
  try {
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    return assistant;
    console.log("Assistant retrieved");
  } catch (error) {
    console.error("There was an error retrieving Assistant ", error);
  }
};


// Function to create thread
const createThread = async () => {
  try {
    const thread = await openai.beta.threads.create();
    return thread;
    console.log("Thread created");
  } catch (error) {
    console.error("Error creating thread ", error);
  }
};


// Function to add a message to a thread
const addMessageToThread = async (threadId, content) => {
  try {
    const message = await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: content,
    });
  } catch (error) {
    console.error("Error adding message to thread ", error);
  }
};

// Function to run the assistant and retreive the response message
const runAssistantAndRetreiveResponse = async (threadId) => {
  let run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  if (run.status === "completed") {
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    return messages.data[0].content[0].text.value
    // for (const message of messages.data.reverse()) {
    //   console.log(`${message.role} > ${message.content[0].text.value}`);
    // }

  } else {
    console.log(run.status);
  }
};

// API endpoint to handle incoming user messages
app.post('/message', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Retrieve the assistant and create a new thread
    const assisant = await retrieveAssistant();
    const thread = await createThread();

    // Add the user message to the thread
    await addMessageToThread(thread.id, userMessage);

    // Get the AI's response
    const aiResponse = await runAssistantAndRetreiveResponse(thread.id);

    // Send the AI response back to the frontend
    res.json({ aiMessage: aiResponse });
  } catch (error) {
    console.error("Error during AI message processing:", error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:3000`);
});