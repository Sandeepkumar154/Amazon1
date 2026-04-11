require('dotenv').config();
const https = require('https');

const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'dealkart-india';

function fetchPage(pageToken = '') {
  let url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const json = JSON.parse(data);
      const docs = json.documents || [];
      console.log(`Fetched ${docs.length} products (pageToken: ${Boolean(pageToken)}).`);
      
      let duplicatesToDelete = [];
      let toFix = [];
      let seen = new Set();
      
      docs.forEach(doc => {
        let name = doc.fields.name?.stringValue;
        let cat = doc.fields.cat?.stringValue;
        let link = doc.fields.link?.stringValue;
        let asin = name;
        if(link) {
           let m = link.match(/\/dp\/([A-Z0-9]{10})/i);
           if (m) asin = m[1];
        }

        if (seen.has(asin)) {
          duplicatesToDelete.push(doc.name); // Full resource name for deletion
        } else {
          seen.add(asin);
        }

        if (cat === 'fashion' && (name.toLowerCase().includes('kennel') || name.toLowerCase().includes('pet '))) {
           toFix.push({ name: doc.name, title: name });
        }
      });
      
      console.log(`Found ${duplicatesToDelete.length} duplicates and ${toFix.length} to fix in this page.`);
      
      // Test delete first one
      if (duplicatesToDelete.length > 0) {
        console.log("Attempting REST delete of duplicate...");
        const delReq = https.request({
          hostname: 'firestore.googleapis.com',
          path: `/v1/${duplicatesToDelete[0]}`,
          method: 'DELETE'
        }, r => {
          console.log('Delete status:', r.statusCode);
        });
        delReq.end();
      }

      if (toFix.length > 0) {
        console.log("Attempting REST update of category...");
        const body = JSON.stringify({
           fields: { cat: { stringValue: 'pets' }, subcat: { stringValue: 'Dog Accessories' } }
        });
        const patchReq = https.request({
          hostname: 'firestore.googleapis.com',
          path: `/v1/${toFix[0].name}?updateMask.fieldPaths=cat&updateMask.fieldPaths=subcat`,
          method: 'PATCH',
          headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}
        }, r => {
          console.log('Update status:', r.statusCode);
        });
        patchReq.write(body);
        patchReq.end();
      }
      
    });
  });
}

fetchPage();
