import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const htmlPath = '/Users/nicholasmacaskill/Downloads/bet-bodhi/scratch/report.html';
    if (!fs.existsSync(htmlPath)) {
        console.error(`HTML report template not found at ${htmlPath}. Run generate_report_pdf.ts first.`);
        return;
    }

    console.log("Launching Playwright to capture report images...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set a viewport size that matches A4 aspect ratio nicely (around 800 x 1130 px per page)
    await page.setViewportSize({ width: 800, height: 2300 });
    
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    
    // Wait for Chart.js rendering to be completely stable
    await page.waitForTimeout(1500);

    const reportsDir = '/Users/nicholasmacaskill/Downloads/bet-bodhi/reports';
    const browserArtifactsDir = '/Users/nicholasmacaskill/.gemini/antigravity/brain/31e9aa45-4f40-4f7d-bb74-56cbfcb1135b/browser';

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    if (!fs.existsSync(browserArtifactsDir)) {
        fs.mkdirSync(browserArtifactsDir, { recursive: true });
    }

    // Capture Page 1 (first page-break div)
    // In our HTML, page 1 is the first child div of body, page 2 is the second child div.
    const bodyChildren = await page.$$('body > div');
    
    if (bodyChildren.length >= 2) {
        console.log("Capturing Page 1 screenshot...");
        await bodyChildren[0].screenshot({
            path: path.join(reportsDir, 'MLB_Performance_Report_Page1.png')
        });
        await bodyChildren[0].screenshot({
            path: path.join(browserArtifactsDir, 'MLB_Performance_Report_Page1.png')
        });

        console.log("Capturing Page 2 screenshot...");
        await bodyChildren[1].screenshot({
            path: path.join(reportsDir, 'MLB_Performance_Report_Page2.png')
        });
        await bodyChildren[1].screenshot({
            path: path.join(browserArtifactsDir, 'MLB_Performance_Report_Page2.png')
        });
        
        console.log("Images saved successfully.");
    } else {
        // Fallback: capture full page
        console.log("Capturing full page screenshot...");
        await page.screenshot({
            path: path.join(reportsDir, 'MLB_Performance_Report_Full.png'),
            fullPage: true
        });
        await page.screenshot({
            path: path.join(browserArtifactsDir, 'MLB_Performance_Report_Full.png'),
            fullPage: true
        });
    }

    await browser.close();
}

main().catch(console.error);
