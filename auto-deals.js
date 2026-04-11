/*  ═══════════════════════════════════════════════════
    DealKart India — Auto-Deal Finder
    Finds trending Amazon India deals & adds to Firestore
    Run: node auto-deals.js
    ═══════════════════════════════════════════════════ */

require('dotenv').config();
const crypto = require('crypto');
const https = require('https');

// ─── CONFIG ───
const ACCESS_KEY  = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY  = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const HOST        = 'webservices.amazon.in';
const REGION      = 'eu-west-1';
const FB_API_KEY  = process.env.FIREBASE_API_KEY;
const FB_PROJECT  = process.env.FIREBASE_PROJECT_ID;

// ─── SEARCH QUERIES BY CATEGORY ───
const SEARCH_QUERIES = [
  { cat: 'fashion',     index: 'Apparel',          keywords: ['mens casual shirt', 'women tops', 'sneakers men', 'women dress', 'kids clothing', 'men kurta', 'women saree', 'mens jeans', 'workout leggings women', 'tshirts men pack', 'mens formal shoes', 'womens heels', 'sunglasses unisex', 'winter jacket men', 'women handbag', 'kids sport shoes'] },
  { cat: 'beauty',      index: 'Beauty',            keywords: ['face serum', 'lipstick', 'sunscreen', 'hair serum', 'perfume women', 'moisturizer dry skin', 'face wash oily skin', 'hair straightener', 'mens grooming kit', 'nail artist kit', 'essential oils', 'body lotion', 'anti aging cream'] },
  { cat: 'home',        index: 'HomeAndKitchen',    keywords: ['kitchen cookware', 'home decor', 'bedsheet', 'vacuum cleaner', 'led light', 'non stick pan', 'water bottle thermos', 'office chair', 'study table', 'curtains living room', 'coffee mug set', 'air purifier', 'juicer mixer grinder', 'storage organisers'] },
  { cat: 'electronics', index: 'Electronics',       keywords: ['wireless earbuds', 'smartwatch', 'power bank', 'bluetooth speaker', 'phone charger', 'gaming mouse', 'mechanical keyboard', 'usb c hub', 'laptop stand', 'wifi router', 'ring light', 'security camera', 'tablet case'] },
  { cat: 'books',       index: 'Books',             keywords: ['fiction novel', 'self help book', 'educational textbook', 'children story book', 'business biography', 'cookbook recipes', 'stock market books', 'productivity planner', 'coloring book kids'] },
  { cat: 'books',       index: 'ToysAndGames',      keywords: ['action figure kids', 'board game family', 'educational puzzle kids', 'building blocks toy', 'remote control car', 'soft toys', 'learning laptop kids', 'art and craft kit'] },
  { cat: 'personal',    index: 'HealthPersonalCare', keywords: ['trimmer men', 'shampoo', 'toothbrush electric', 'body wash', 'protein powder', 'yoga mat', 'massage gun', 'skipping rope', 'weighing machine', 'multivitamin tablets'] },
  { cat: 'baby',        index: 'Baby',              keywords: ['baby diaper', 'baby toys', 'feeding bottle', 'baby skin care', 'baby stroller', 'baby wipes', 'baby carrier', 'baby food maker', 'muslin swaddle'] },
  { cat: 'pets',        index: 'PetSupplies',       keywords: ['dog food', 'dog collar', 'cat toy', 'pet grooming', 'dog bed', 'cat litter box', 'aquarium filter', 'bird cage accessories', 'dog squeaky toy'] },
];

// ─── PA-API v5 SIGNING (AWS4) ───
function sha256(data) { return crypto.createHash('sha256').update(data, 'utf8').digest(); }
function hmac(key, data) { return crypto.createHmac('sha256', key).update(data, 'utf8').digest(); }

function signRequest(payload) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);
  const path = '/paapi5/searchitems';
  const service = 'ProductAdvertisingAPI';

  const headers = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    'host': HOST,
    'x-amz-date': amzDate,
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => k + ':' + headers[k]).join('\n') + '\n';
  const payloadHash = sha256(payload).toString('hex');
  const canonicalReq = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credScope = [dateStamp, REGION, service, 'aws4_request'].join('/');
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, sha256(canonicalReq).toString('hex')].join('\n');

  let sigKey = hmac('AWS4' + SECRET_KEY, dateStamp);
  sigKey = hmac(sigKey, REGION);
  sigKey = hmac(sigKey, service);
  sigKey = hmac(sigKey, 'aws4_request');
  const signature = hmac(sigKey, strToSign).toString('hex');

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

// ─── PA-API SEARCH ───
function searchItems(searchIndex, keywords) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      Keywords: keywords,
      SearchIndex: searchIndex,
      PartnerTag: PARTNER_TAG,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.in',
      ItemCount: 5,
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.ByLineInfo',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.MerchantInfo',
        'Images.Primary.Large',
        'Images.Variants.Large',
        'BrowseNodeInfo.BrowseNodes',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count'
      ],
      SortBy: 'Featured',
      MinReviewsRating: 4,
      Condition: 'New'
    });

    const headers = signRequest(body);
    const options = { hostname: HOST, path: '/paapi5/searchitems', method: 'POST', headers };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Errors) {
            console.log(`  ⚠️  API error for "${keywords}":`, json.Errors[0].Message);
            resolve([]);
          } else {
            resolve(json.SearchResult?.Items || []);
          }
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.write(body);
    req.end();
  });
}

// ─── FIRESTORE REST API ───
async function getExistingASINs() {
  return new Promise((resolve) => {
    const asins = new Set();
    
    function fetchPage(pageToken = '') {
      let url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            (json.documents || []).forEach(doc => {
              const link = doc.fields?.link?.stringValue || '';
              const m = link.match(/\/dp\/([A-Z0-9]{10})/i);
              if (m) asins.add(m[1]);
            });
            
            if (json.nextPageToken) {
              fetchPage(json.nextPageToken);
            } else {
              resolve(asins);
            }
          } catch (e) { resolve(asins); }
        });
      }).on('error', () => resolve(asins));
    }
    
    fetchPage();
  });
}

async function addToFirestore(product) {
  return new Promise((resolve) => {
    const doc = {
      fields: {
        name: { stringValue: product.name },
        cat: { stringValue: product.cat },
        subcat: { stringValue: product.subcat || '' },
        price: { integerValue: String(product.price) },
        was: { integerValue: String(product.was) },
        images: { arrayValue: { values: product.images.map(u => ({ stringValue: u })) } },
        link: { stringValue: product.link },
        rating: { doubleValue: product.rating },
        reviews: { integerValue: String(product.reviews) },
        active: { booleanValue: true },
        ts: { timestampValue: new Date().toISOString() }
      }
    };

    const body = JSON.stringify(doc);
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${FB_PROJECT}/databases/(default)/documents/products`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ─── SUBCATEGORY DETECTION (mirrors app.js logic) ───
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
  if (cat === 'beauty') {
    let g = text.match(/men(\'s|\s|$)/) ? "Men's" : "Women's";
    if (text.includes('serum') || text.includes('moisturizer') || text.includes('sunscreen') || text.includes('face wash') || text.includes('cream')) return g + ' Skincare';
    if (text.includes('shampoo') || text.includes('conditioner') || text.includes('hair')) return g + ' Haircare';
    if (text.includes('perfume') || text.includes('fragrance') || text.includes('deodorant')) return g + ' Fragrance';
    if (text.includes('lipstick') || text.includes('foundation') || text.includes('mascara') || text.includes('kajal') || text.includes('makeup')) return 'Makeup';
  }
  if (cat === 'home') {
    if (text.includes('pan') || text.includes('kadai') || text.includes('tawa') || text.includes('cookware') || text.includes('cooker')) return 'Cookware';
    if (text.includes('mixer') || text.includes('grinder') || text.includes('blender') || text.includes('toaster') || text.includes('kettle')) return 'Kitchen Appliances';
    if (text.includes('decor') || text.includes('wall') || text.includes('vase') || text.includes('clock')) return 'Home Decor';
    if (text.includes('bedsheet') || text.includes('pillow') || text.includes('curtain') || text.includes('blanket')) return 'Bedding & Linen';
    if (text.includes('vacuum') || text.includes('mop') || text.includes('cleaner') || text.includes('wipe')) return 'Cleaning Supplies';
    if (text.includes('lamp') || text.includes('light') || text.includes('led') || text.includes('bulb')) return 'Lighting';
    if (text.includes('table') || text.includes('chair') || text.includes('shelf') || text.includes('desk') || text.includes('sofa')) return 'Furniture';
    if (text.includes('storage') || text.includes('organizer') || text.includes('box') || text.includes('basket')) return 'Storage & Organization';
    if (text.includes('garden') || text.includes('plant') || text.includes('planter') || text.includes('lawn')) return 'Garden & Outdoor';
  }
  if (cat === 'electronics') {
    if (text.includes('wireless') || text.includes('bluetooth') || text.includes('tws') || text.includes('neckband') || text.includes('airpods')) return 'Wireless Headphones';
    if (text.includes('wired') && (text.includes('earphone') || text.includes('headphone'))) return 'Wired Headphones';
    if (text.includes('smartwatch') || text.includes('smart watch') || text.includes('fitness band')) return 'Smartwatches';
    if (text.includes('speaker') || text.includes('soundbar')) return 'Bluetooth Speakers';
    if (text.includes('charger') || text.includes('cable') || text.includes('adapter') || text.includes('usb')) return 'Chargers & Cables';
    if (text.includes('power bank')) return 'Power Banks';
    if (text.includes('phone') || text.includes('mobile') || text.includes('smartphone')) return 'Smartphones';
    if (text.includes('laptop') || text.includes('computer')) return 'Laptops & Computers';
    if (text.includes('camera') || text.includes('gopro') || text.includes('webcam') || text.includes('dslr')) return 'Cameras';
    if (text.includes('alexa') || text.includes('echo') || text.includes('smart plug') || text.includes('smart bulb')) return 'Smart Home';
  }
  if (cat === 'books') {
    if (text.includes('toy') || text.includes('action figure') || text.includes('doll') || text.includes('car')) return 'Action Toys';
    if (text.includes('game') || text.includes('board')) return 'Board Games';
    if (text.includes('puzzle')) return 'Puzzles';
    if (text.includes('fiction') || text.includes('novel') || text.includes('story') || text.includes('thriller')) return 'Fiction';
    if (text.includes('self') || text.includes('habit') || text.includes('mindset') || text.includes('business')) return 'Self-Help';
    if (text.includes('biography') || text.includes('history') || text.includes('non-fiction')) return 'Non-Fiction';
    if (text.includes('kid') || text.includes('children') || text.includes('coloring')) return 'Kids Books';
    if (text.includes('education') || text.includes('exam') || text.includes('study')) return 'Educational';
  }
  if (cat === 'personal') {
    if (text.includes('trimmer') || text.includes('razor') || text.includes('shaving') || text.includes('beard')) return "Men's Grooming";
    if (text.includes('shampoo') || text.includes('conditioner') || text.includes('hair oil')) return (text.includes('men') ? "Men's" : "Women's") + ' Hair Care';
    if (text.includes('toothpaste') || text.includes('toothbrush') || text.includes('oral')) return 'Oral Care';
    if (text.includes('body wash') || text.includes('soap') || text.includes('lotion')) return 'Body Care';
    if (text.includes('pad') || text.includes('tampon') || text.includes('hygiene') || text.includes('wash')) return "Women's Hygiene";
    if (text.includes('health') || text.includes('wellness') || text.includes('vitamin') || text.includes('supplement')) return "Health & Wellness";
  }
  if (cat === 'baby') {
    if (text.includes('boy')) return 'Baby Boy Clothing';
    if (text.includes('girl')) return 'Baby Girl Clothing';
    if (text.includes('diaper') || text.includes('wipe')) return 'Diapers & Wipes';
    if (text.includes('toy')) return 'Baby Toys';
    if (text.includes('bottle') || text.includes('feed')) return 'Feeding Essentials';
    if (text.includes('bath') || text.includes('lotion') || text.includes('soap')) return 'Bath & Skin Care';
    return 'Gear & Safety';
  }
  if (cat === 'pets') {
    if (text.includes('dog')) return text.includes('food') || text.includes('treat') ? 'Dog Food' : 'Dog Accessories';
    if (text.includes('cat')) return text.includes('food') || text.includes('treat') ? 'Cat Food' : 'Cat Accessories';
    if (text.includes('fish') || text.includes('aquarium')) return 'Fish & Aquarium';
    if (text.includes('bird')) return 'Bird Supplies';
    if (text.includes('grooming') || text.includes('brush') || text.includes('shampoo')) return 'Pet Grooming';
  }
  return '';
}

// ─── PARSE PA-API RESPONSE TO PRODUCT ───
function parseItem(item, cat) {
  const title = item.ItemInfo?.Title?.DisplayValue || '';
  let rawPrice = item.Offers?.Listings?.[0]?.Price?.Amount || 0;
  let rawWas = item.Offers?.Listings?.[0]?.SavingBasis?.Amount || 0;
  const rating = item.CustomerReviews?.StarRating?.Value || 4.5;
  const reviews = item.CustomerReviews?.Count || 0;
  const asin = item.ASIN || '';

  if (rawPrice > 10000 && rawPrice % 100 === 0) rawPrice = rawPrice / 100;
  if (rawWas > 10000 && rawWas % 100 === 0) rawWas = rawWas / 100;

  let price = Math.round(rawPrice);
  let was = Math.round(rawWas || price * 1.3);

  if (was <= price) {
    was = 0;
  }

  const images = [];
  const primary = item.Images?.Primary?.Large?.URL;
  if (primary) images.push(primary);
  const variants = item.Images?.Variants || [];
  variants.forEach(v => { if (v.Large?.URL) images.push(v.Large.URL); });

  const link = `https://www.amazon.in/dp/${asin}?tag=${PARTNER_TAG}`;
  const subcat = detectSubcategory(title, cat);

  return {
    name: title,
    cat, subcat,
    price,
    was,
    rating: parseFloat(rating) || 4.5,
    reviews: parseInt(reviews) || 0,
    images: images.slice(0, 6),
    link, asin
  };
}

// ─── MAIN ───
async function main() {
  console.log('\n🚀 DealKart Auto-Deal Finder');
  console.log('═'.repeat(50));

  console.log('\n📦 Checking existing products...');
  const existingASINs = await getExistingASINs();
  console.log(`   Found ${existingASINs.size} existing products\n`);

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const catConfig of SEARCH_QUERIES) {
    console.log(`\n🏷️  ${catConfig.cat.toUpperCase()}`);

    const shuffled = catConfig.keywords.sort(() => Math.random() - 0.5);
    const selectedKeywords = shuffled.slice(0, 4);

    for (const keyword of selectedKeywords) {
      console.log(`   🔍 Searching: "${keyword}"...`);

      const items = await searchItems(catConfig.index, keyword);
      console.log(`   📋 Found ${items.length} results`);

      for (const item of items) {
        const product = parseItem(item, catConfig.cat);

        if (existingASINs.has(product.asin)) {
          totalSkipped++;
          continue;
        }

        if (!product.images.length || !product.name || product.price < 100) continue;

        if (product.rating < 4.0) continue;

        const discount = product.was > 0 ? ((product.was - product.price) / product.was * 100) : 0;
        if (discount < 15) continue;

        const success = await addToFirestore(product);
        if (success) {
          existingASINs.add(product.asin);
          totalAdded++;
          console.log(`   ✅ Added: ${product.name.substring(0, 50)}... (₹${product.price}, ${Math.round(discount)}% off) → ${product.subcat || 'No subcat'}`);
        }
      }

      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Done! Added ${totalAdded} new deals, skipped ${totalSkipped} duplicates.`);
  console.log('═'.repeat(50) + '\n');
}

main().catch(console.error);

