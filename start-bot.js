const { spawn } = require('child_process');

// Configuration
const RUN_INTERVAL_HOURS = 1;
const INTERVAL_MS = RUN_INTERVAL_HOURS * 60 * 60 * 1000;

function runAutoDeals() {
    console.log(`\n[${new Date().toLocaleString()}] 🕒 Starting hourly deal scan...`);
    
    // Spawn the auto-deals.js script process
    const child = spawn('node', ['auto-deals.js'], { stdio: 'inherit' });
    
    child.on('close', (code) => {
        if (code === 0) {
            console.log(`[${new Date().toLocaleString()}] ✅ Scan cycle finished successfully.`);
        } else {
            console.error(`[${new Date().toLocaleString()}] ❌ Scan cycle exited with error code ${code}`);
        }
        
        let nextRun = new Date(Date.now() + INTERVAL_MS);
        console.log(`⏳ Sleeping for ${RUN_INTERVAL_HOURS} hour(s)... Next run at: ${nextRun.toLocaleTimeString()}`);
    });
}

// 1. Run immediately on startup
runAutoDeals();

// 2. Set interval to run continuously every hour
setInterval(runAutoDeals, INTERVAL_MS);

console.log(`\n🤖 DealKart Bot is now ACTIVE!`);
console.log(`We will automatically search Amazon every ${RUN_INTERVAL_HOURS} hour(s) for the best products tracking to our criteria.`);
console.log(`Just keep this terminal window open! Press Ctrl+C to stop.\n`);
