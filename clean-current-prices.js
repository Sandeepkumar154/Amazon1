require('dotenv').config();
const https = require('https');
const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'dealkart-india';

function fetchFirebase() {
  let url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).documents || []));
    });
  });
}

function normalizePaisa(p) {
  // If price is suspiciously exact hundreds and extremely high (> 10,000)
  // For example, a 1500 rupee product having 150000 price.
  if (p > 10000 && p % 100 === 0) {
    return p / 100;
  }
  return p;
}

async function run() {
  const docs = await fetchFirebase();
  console.log(`Checking ${docs.length} products for paise bug in CURRENT prices...`);
  let fixedCount = 0;
  
  for (let doc of docs) {
    let p = parseInt(doc.fields.price?.integerValue || doc.fields.price?.doubleValue || 0);
    // Some products are manually added correctly.
    if (!p) continue;
    
    // Look for prices that are way too high
    let newP = normalizePaisa(p);
    
    if (newP !== p) {
      console.log(`[FIXING PAISED CURRENT PRICE] ${doc.fields.name.stringValue.substring(0,30)} | Current Price: ₹${p} => ₹${newP}`);
      
      const body = JSON.stringify({ fields: { price: { integerValue: newP } } });
      const patchReq = https.request({
           hostname: 'firestore.googleapis.com',
           path: `/v1/${doc.name}?updateMask.fieldPaths=price`,
           method: 'PATCH',
           headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}
      }, (res) => {});
      patchReq.write(body);
      patchReq.end();
      fixedCount++;
      await new Promise(r => setTimeout(r, 200)); 
    }
  }
  console.log(`Done resolving current prices! Fixed ${fixedCount} products.`);
}

run();
