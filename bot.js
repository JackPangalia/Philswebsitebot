import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import fs from 'fs'

// Define the openai client
const openai = new OpenAI({
  apiKey:
    "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",
});

// Helper function to clean up text
const cleanText = (text) => text.replace(/\s+/g, " ").trim();

//TODO: MAKE IT SO IT REPLACES THE FILE RATHER THAN KEEP ADDING IT
//* CODE RELATED TO EXTRACTING REALESTATE LISTINGS (BELOW) *// 
// Function to extract listing information from a page
const extractListingInfo = ($, element) => ({
  listingId: $(element).attr("data-listing-id"),
  shareUrl: $(element).attr("ata-share-url"),
  listingDetails: cleanText(
    $(element).find(".mrp-listing-summary-outer").text()
  ),
  price: $(element).find(".mrp-listing-price-container").text().trim(),
  address: cleanText($(element).find(".mrp-listing-address-info").text()),
});

// Function to get listings from a page
async function getLinksFromPage(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    return $("li.mrp-listing-result")
      .map((i, element) => extractListingInfo($, element))
      .get();
  } catch (error) {
    console.error("Error fetching the page:", error);
    return [];
  }
}

// Function to scrape detailed information from a listing page
async function scrapeListingDetails(shareUrl) {
  try {
    const { data } = await axios.get(shareUrl);
    const $ = cheerio.load(data);
    return cleanText($(".mrp-listing-info-container").text());
  } catch (error) {
    console.error(
      `Error fetching the listing details from ${shareUrl}:`,
      error
    );
    return null;
  }
}

// Function to scrape all listings with details
async function scrapeAllListingsWithDetails(mainUrl) {
  const listings = await getLinksFromPage(mainUrl);
  const detailedListings = await Promise.all(
    listings.map(async (listing) => ({
      ...listing,
      detailedInfo: await scrapeListingDetails(listing.shareUrl),
    }))
  );
  return detailedListings.filter((listing) => listing.detailedInfo !== null);
}

// Function to save scraped atat to a file
const saveScrapedDataToFile = (data, fileName) => {
  fs.writeFileSync(fileName, JSON.stringify(data, null, 2))
  console.log(`Data saved to ${fileName}`);
}

// Function to upload the file to OpenAI vector store
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

// Main function to scrape and update the vector store daily
const scrapeAndUpdate = async () => {
  try {
    const listings = await scrapeAllListingsWithDetails("https://dorisgee.com/mylistings.html");
    
    // Save the scraped data to a file
    const fileName = `scraped_data_${new Date().toISOString().split('T')[0]}.json`;
    saveScrapedDataToFile(listings, fileName);
    
    // Upload the file to OpenAI vector store
    await uploadFileToOpenAI(fileName);

    console.log("Scraping and uploading completed.");
  } catch (error) {
    console.error("An error occurred during scraping and updating:", error);
  }
};

// Schedule the task to run every day at midnight
setInterval(async () => {
  console.log("Running scrapeAndUpdate function for testing...");
  await scrapeAndUpdate();
}, 30 * 1000); // 60 * 1000 milliseconds = 1 minute

//* CODE RELATED TO EXTRACTING REALESTATE LISTINGS (ABOVE) *//

//* CODE RELATED TO RUNNING THE ASSISTANT USING THE OPENAI ASSISTANT API (BELOW) *//

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

// Function to add messsage to a thread
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
    for (const message of messages.data.reverse()) {
      console.log(`${message.role} > ${message.content[0].text.value}`);
    }
  } else {
    console.log(run.status);
  }
};

// Main function to run the scraper
async function main() {
  try {
    //! TRYING TO ADD FILES TO FILEBASE VECTORSTORE
    const file = await openai.files.create({
      file: fs.createReadStream('test.txt'),
      purpose: 'assistants'
    })

    const myVectorStoreFile = await openai.beta.vectorStores.files.create(
      "vs_wjbc6c0aO6Rf6krRnQjWMjGF",
      {
        file_id: file.id
      }
    );
    console.log(myVectorStoreFile);


    const assisant = await retrieveAssistant();
    const thread = await createThread();

    await addMessageToThread(thread.id, "Hello");
    runAssistantAndRetreiveResponse(thread.id);

    // const results = await scrapeAllListingsWithDetails('https://dorisgee.com/mylistings.html');
    // console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("An error occurred during scraping:", error);
  }
}

main();