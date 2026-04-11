require('dotenv').config();
const https = require('https');
const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'dealkart-india';

function fetchFirebase(pageToken = '') {
  let url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).documents || []));
    });
  });
}

function scrapeAmazonMRP(url) {
  return new Promise((resolve) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      }
    };
    https.get(url, opts, (res) => {
      if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // handle redirect
        return https.get(res.headers.location, opts, r2 => {
            let data = '';
            r2.on('data', c => data += c);
            r2.on('end', () => resolve(extractMrp(data)));
        });
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(extractMrp(data)));
    }).on('error', () => resolve(null));
  });
}

function extractMrp(html) {
    // Look for <span class="a-price a-text-price...><span class="a-offscreen">₹5,999</span></span>
    let m = html.match(/class="a-price a-text-price"[^>]*>.*?<span class="a-offscreen">[^0-9]*([0-9,]+)/i);
    if (!m) m = html.match(/class="a-text-strike"[^>]*>.*?([0-9,]+)/i);
    if (m && m[1]) {
        return parseInt(m[1].replace(/,/g, ''));
    }
    return null;
}

async function run() {
  const docs = await fetchFirebase();
  console.log(`Scanning ${docs.length} products to find broken MRPs...`);
  
  for (let doc of docs) {
    let p = parseInt(doc.fields.price?.integerValue || doc.fields.price?.doubleValue || 0);
    let w = parseInt(doc.fields.was?.integerValue || doc.fields.was?.doubleValue || 0);
    let link = doc.fields.link?.stringValue || '';
    
    // The bug forced MRP to exactly price * 2. 
    // And if W < P it forced it to price * 1.3
    // But any watches whose MRP is *actually* huge were chopped to exactly p * 2.
    if (w === p * 2 && p > 0 && link.includes('amazon.')) {
      console.log(`[SUSPECTED BUG] ${doc.fields.name.stringValue.substring(0,30)} | Price: ${p} | Cut MRP: ${w}`);
      
      let realMrp = await scrapeAmazonMRP(link);
      if (realMrp && realMrp > w) {
        console.log(`   -> 🔥 Scraped REAL MRP from Amazon: ₹${realMrp}`);
        // Update Firebase
        const body = JSON.stringify({ fields: { was: { integerValue: realMrp } } });
        const patchReq = https.request({
             hostname: 'firestore.googleapis.com',
             path: `/v1/${doc.name}?updateMask.fieldPaths=was`,
             method: 'PATCH',
             headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}
        }, r => {});
        patchReq.write(body);
        patchReq.end();
        console.log(`   -> ✅ Restored!`);
      } else {
        console.log(`   ->  Could not scrape MRP or it was not larger. (Got: ${realMrp})`);
      }
      
      // Delay to avoid Amazon blocking IP
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log("Done checking old products!");
}

run();
