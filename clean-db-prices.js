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

function sanitizePrice(price, was) {
  let p = Number(price) || 0;
  let w = Number(was) || 0;
  if (p > 0 && w > p * 5 && (w / 100) >= p) {
    w = Math.round(w / 100);
  }
  if (p > 0 && w > p * 20) {
    w = Math.round(p * 2);
  }
  if (w <= p) {
    w = 0; // Remove fake discounts
  }
  return { price: p, was: w };
}

async function run() {
  const docs = await fetchFirebase();
  console.log(`Scanning ${docs.length} products to deep-clean MRPs in database...`);
  
  let fixedCount = 0;

  for (let doc of docs) {
    let p = parseInt(doc.fields.price?.integerValue || doc.fields.price?.doubleValue || 0);
    // If was isn't set, default to 0
    let originalW = parseInt(doc.fields.was?.integerValue || doc.fields.was?.doubleValue || 0);
    
    if (!doc.fields.price) continue;

    let { was: newW } = sanitizePrice(p, originalW);
    
    if (originalW !== newW) {
      console.log(`[FIXING] ${doc.fields.name.stringValue.substring(0,35)}... | Price: ${p} | OLD MRP: ${originalW} => NEW MRP: ${newW}`);
      
      const body = JSON.stringify({ fields: { was: { integerValue: newW } } });
      const patchReq = https.request({
           hostname: 'firestore.googleapis.com',
           path: `/v1/${doc.name}?updateMask.fieldPaths=was`,
           method: 'PATCH',
           headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}
      }, (res) => {
          let data='';
          res.on('data', c=>data+=c);
      });
      patchReq.write(body);
      patchReq.end();
      
      fixedCount++;
      await new Promise(r => setTimeout(r, 200)); 
    }
  }
  console.log(`\nDone! Successfully fixed ${fixedCount} corrupted MRPs in the database.`);
}

run();
