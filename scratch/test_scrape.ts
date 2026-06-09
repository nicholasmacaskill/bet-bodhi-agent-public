import * as cheerio from 'cheerio';

async function main() {
    console.log("Attempting to scrape MyKBOStats...");
    try {
        const url = 'https://mykbostats.com/schedule/today';
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        console.log(`Status: ${response.status}`);
        
        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Find games on the page. Usually in a table or list.
            // Just doing a broad search for team names or scores to see if the content is there.
            const text = $('body').text();
            
            // Simple check: do we see LG Twins or Doosan?
            if (text.includes('Twins') || text.includes('Bears') || text.includes('Wiz')) {
                 console.log("✅ Found KBO team names in the HTML!");
                 
                 // Try to find the score table
                 const games = [];
                 $('table.table tbody tr').each((i, el) => {
                     const rowText = $(el).text().trim().replace(/\s+/g, ' ');
                     if (rowText.length > 5) {
                         games.push(rowText);
                     }
                 });
                 
                 console.log(`Found ${games.length} potential game rows:`);
                 console.log(games.slice(0, 3));
                 
            } else {
                 console.log("❌ Could not find KBO team names. Page might be empty or structured differently.");
            }
        }
    } catch (e: any) {
        console.error("Scraping failed:", e.message);
    }
}

main().catch(console.error);
