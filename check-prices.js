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

async function run() {
  const docs = await fetchFirebase();
  const suspicious = [];
  
  for (let doc of docs) {
    let p = parseInt(doc.fields.price?.integerValue || doc.fields.price?.doubleValue || 0);
    let originalW = parseInt(doc.fields.was?.integerValue || doc.fields.was?.doubleValue || 0);
    let name = doc.fields.name?.stringValue || 'Unknown';
    let link = doc.fields.link?.stringValue || '';
    
    // Check if price seems exceptionally high or has Trailing Zeros
    if (p > 30000 && p % 100 === 0) {
      suspicious.push({ name: name.substring(0, 50), price: p, was: originalW, link });
    }
  }
  
  suspicious.sort((a,b) => b.price - a.price);
  console.log('--- POTENTIALLY BUGGED CURRENT PRICES (in paise format) ---');
  suspicious.slice(0, 30).forEach(s => {
    console.log(`Price: ₹${s.price} | MRP: ₹${s.was} | Name: ${s.name}`);
  });
}

run();
