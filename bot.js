import puppeteer from "puppeteer";

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto('https://dorisgee.com/mylistings.html');

  // Wait for the listings to load (adjust the selector based on the website)
  await page.waitForSelector('.mrp-listing-result');

  // Scrape listing details (price, address, etc.)
  const listings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.mrp-listing-result')).map(listing => ({
      data: listing.innerText || 'N/A', // Use 'listing' instead of 'listings'
    }));
  });

  console.log('Scraped Listings:', listings); // Print the scraped listings
  await browser.close();
})();

console.log('Script executed.');
