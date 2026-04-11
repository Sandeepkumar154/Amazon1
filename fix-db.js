require('dotenv').config();
const https = require('https');
const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'dealkart-india';

function detectSubcategory(name, cat) {
  const text = name.toLowerCase();
  if (cat === 'fashion') {
    let gender = '';
    if (text.includes('unisex')) gender = 'Unisex';
    else if (text.match(/men(\'s|\s|$)/) || text.includes('boys')) gender = "Men's";
    else if (text.includes('women') || text.includes('ladies') || text.includes('girl')) gender = "Women's";
    else if (text.includes('kids') || text.includes('children')) gender = 'Kids';

    let type = '';
    if (/\b(shoe|sneaker|sandal|slipper|boot|heel|loafer)\b/.test(text)) type = 'Footwear';
    else if (/\b(kurta|saree|lehenga|ethnic|sherwani)\b/.test(text)) type = 'Ethnic Wear';
    else if (/\b(jeans|denim|shirt|t-shirt|tshirt|jacket|dress|top|shorts|hoodie)\b/.test(text)) type = 'Western Wear';
    else if (/\b(sport|gym|track|yoga)\b/.test(text)) type = 'Sportswear';
    else if (/\b(watch|bag|wallet|belt)\b/.test(text)) type = 'Accessories';

    if (gender && type) return gender + ' ' + type;
    if (gender === 'Kids') return 'Kids Wear';
    if (type) return (gender || "Men's") + ' ' + type;
    if (gender) return gender + ' Western Wear';
  }
  if (cat === 'pets') {
    if (text.includes('dog')) return text.includes('food') || text.includes('treat') ? 'Dog Food' : 'Dog Accessories';
    if (text.includes('cat')) return text.includes('food') || text.includes('treat') ? 'Cat Food' : 'Cat Accessories';
  }
  return '';
}

function fetchPage(pageToken = '') {
  let url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const json = JSON.parse(data);
      const docs = json.documents || [];
      console.log(`Fetched ${docs.length} products...`);
      
      let fixed = 0;
      docs.forEach(doc => {
        let name = doc.fields.name?.stringValue || '';
        let cat = doc.fields.cat?.stringValue || '';
        let oldSub = doc.fields.subcat?.stringValue || '';
        
        let newSub = detectSubcategory(name, cat);
        if (newSub && newSub !== oldSub) {
           console.log(`Fixing [${name.substring(0,30)}] :  ${oldSub} -> ${newSub}`);
           const body = JSON.stringify({ fields: { subcat: { stringValue: newSub } } });
           const patchReq = https.request({
             hostname: 'firestore.googleapis.com',
             path: `/v1/${doc.name}?updateMask.fieldPaths=subcat`,
             method: 'PATCH',
             headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}
           }, r => {});
           patchReq.write(body);
           patchReq.end();
           fixed++;
        }
      });
      console.log(`Total fixed on this page: ${fixed}`);
    });
  });
}

fetchPage();
