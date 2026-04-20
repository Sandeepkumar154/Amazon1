/*  ═══════════════════════════════════════════════════
    DealKart India — Auto-Deal Finder (Scraper Edition)
    Uses APILayer Advanced Scraper to get REAL prices
    from Amazon India — no PA-API Offers restriction!
    Run: node auto-deals.js
═══════════════════════════════════════════════════ */

require('dotenv').config();
const https = require('https');

// ─── CONFIG ───
const PARTNER_TAG    = process.env.AMAZON_PARTNER_TAG || 'sandeepku0b19-21';
const SCRAPER_KEY    = process.env.APILAYER_KEY || '4sbXvvRtavRdUqrm93PpnJ4T7qfUSKtB';
const FB_PROJECT     = process.env.FIREBASE_PROJECT_ID;

// Keep PA-API credentials for potential fallback
const ACCESS_KEY     = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY     = process.env.AMAZON_SECRET_KEY;
const PA_API_HOST    = 'webservices.amazon.in';
const PA_API_REGION  = 'eu-west-1';

// ─── SEARCH QUERIES BY CATEGORY ───
const SEARCH_QUERIES = [
  // ── FASHION (Subcats: Men's/Women's Footwear, Western Wear, Ethnic Wear, Sportswear, Accessories, Kids Wear) ──
  { cat: 'fashion', keywords: ['mens casual shirt deal', 'women western dress', 'sneakers men', 'women kurta set', 'kids clothing set', 'men kurta pajama', 'women saree under 1000', 'mens jeans slim fit', 'women sports shoes', 'tshirts men combo pack', 'mens formal shoes leather', 'womens heels sandals', 'sunglasses unisex polarized', 'winter jacket men', 'women handbag stylish', 'kids school shoes', 'mens wallet leather', 'women leggings gym', 'mens ethnic sherwani', 'women lehenga'] },

  // ── BEAUTY (Subcats: Skincare, Haircare, Fragrance, Makeup, Nails, Tools & Brushes) ──
  { cat: 'beauty', keywords: ['face serum vitamin c', 'lipstick matte long lasting', 'sunscreen spf 50', 'hair serum anti frizz', 'perfume women long lasting', 'moisturizer dry skin', 'face wash for oily skin', 'hair straightener women', 'mens grooming kit', 'nail polish gel', 'makeup brush set', 'kajal waterproof', 'foundation full coverage', 'hair oil for growth', 'anti aging cream women', 'body lotion winter', 'deodorant men'] },

  // ── HOME & LIVING (Subcats: Cookware, Kitchen Appliances, Home Decor, Furniture, Storage, Bedding, Cleaning, Lighting, Garden) ──
  { cat: 'home', keywords: ['non stick cookware set', 'home decor wall art', 'bedsheet double bed cotton', 'vacuum cleaner robot', 'led bulb smart', 'non stick tawa', 'water bottle steel thermos', 'office chair ergonomic', 'study table foldable', 'curtains living room blackout', 'coffee mug ceramic set', 'air purifier room', 'mixer grinder juicer', 'storage organiser wardrobe', 'kitchen rack steel', 'wall clock decorative', 'garden tools set', 'sofa cushion cover'] },

  // ── ELECTRONICS (Subcats: Smartphones, Laptops, Wired/Wireless Headphones, Smartwatches, Speakers, Cameras, Chargers, Power Banks, Smart Home) ──
  { cat: 'electronics', keywords: ['wireless earbuds bluetooth', 'smartwatch under 2000', 'power bank 10000mah', 'bluetooth speaker portable', 'fast charger type c', 'gaming mouse', 'usb c hub', 'laptop stand', 'wifi router', 'smartphone under 15000', 'smart plug wifi', 'wired earphones bass', 'smart bulb led', 'security camera wifi', 'headphones over ear'] },

  // ── BOOKS (Subcats: Fiction, Non-Fiction, Self-Help, Educational, Kids Books) ──
  { cat: 'books', keywords: ['fiction novel bestseller', 'self help book motivational', 'ncert textbook', 'children story book illustrated', 'business biography book', 'cookbook indian recipes', 'stock market investing book', 'productivity planner journal', 'coloring book kids', 'upsc preparation book', 'hindi novel', 'english grammar book'] },

  // ── TOYS & GAMES (under 'books' cat — Subcats: Action Toys, Board Games, Puzzles) ──
  { cat: 'books', keywords: ['action figure marvel', 'board game family fun', 'educational puzzle kids', 'building blocks lego', 'remote control car kids', 'soft toys teddy bear', 'learning toy kids educational', 'art and craft kit kids', 'chess board set', 'card game family'] },

  // ── PERSONAL CARE (Subcats: Men's Grooming, Women's Hygiene, Oral Care, Hair Care, Body Care, Health & Wellness) ──
  { cat: 'personal', keywords: ['trimmer men philips', 'shampoo anti dandruff', 'electric toothbrush rechargeable', 'body wash shower gel', 'protein powder whey', 'yoga mat thick', 'massage gun deep tissue', 'skipping rope weighted', 'digital weighing machine', 'multivitamin tablets daily', 'beard oil men', 'face razor women'] },

  // ── BABY PRODUCTS (Subcats: Baby Boy/Girl Clothing, Feeding, Diapers, Toys, Bath, Gear) ──
  { cat: 'baby', keywords: ['baby diaper pants', 'baby toys 0-12 months', 'feeding bottle anti colic', 'baby skin care set', 'baby stroller lightweight', 'baby wipes sensitive', 'baby carrier ergonomic', 'baby food maker blender', 'muslin swaddle blanket', 'baby boy clothes set', 'baby girl dress', 'baby bath tub'] },

  // ── PET SUPPLIES (Subcats: Dog Food/Accessories, Cat Food/Accessories, Fish/Aquarium, Bird, Pet Grooming) ──
  { cat: 'pets', keywords: ['dog food pedigree', 'dog collar leash', 'cat toy interactive', 'pet grooming kit', 'dog bed washable', 'cat litter box', 'aquarium filter pump', 'bird cage large', 'dog chew toy', 'cat food whiskas', 'dog shampoo tick', 'fish food pellets'] },

  // ── SPORTS & FITNESS (Subcats: Cricket, Football, Badminton, Gym Equipment, Yoga, Running, Cycling, Swimming, Sports Nutrition) ──
  { cat: 'sports', keywords: ['cricket bat english willow', 'football shoes men', 'badminton racket yonex', 'dumbbells adjustable', 'yoga mat thick premium', 'running shoes men nike', 'cycling accessories', 'swimming goggles', 'protein powder whey', 'gym gloves men', 'cricket ball leather', 'resistance bands set', 'treadmill home', 'sports bra women', 'skipping rope weighted', 'table tennis racket', 'boxing gloves', 'knee cap support'] },

  // ── GROCERIES & GOURMET (Subcats: Snacks, Beverages, Cooking Essentials, Dry Fruits, Health Foods, Spices, Chocolates, Organic) ──
  { cat: 'grocery', keywords: ['dry fruits combo pack', 'green tea organic', 'honey pure natural', 'dark chocolate premium', 'masala spice box', 'oats breakfast', 'peanut butter', 'basmati rice', 'olive oil extra virgin', 'protein bar healthy', 'cookies biscuits combo', 'coffee beans arabica', 'ghee pure cow', 'jaggery organic', 'trail mix nuts'] },

  // ── AUTOMOTIVE (Subcats: Car Accessories, Bike Accessories, Car Electronics, Helmet, Car Care, Tools) ──
  { cat: 'auto', keywords: ['car phone holder dashboard', 'bike helmet full face', 'car seat cover leather', 'dash cam car', 'car vacuum cleaner', 'bike mobile holder', 'car perfume air freshener', 'tyre inflator portable', 'car charger fast', 'bike accessories combo', 'car cleaning kit', 'gps tracker vehicle'] },

  // ── OFFICE & STATIONERY (Subcats: Pens, Notebooks, Desk Organizers, Printers, School Supplies, Art Supplies) ──
  { cat: 'office', keywords: ['pen parker premium', 'notebook diary premium', 'desk organizer wooden', 'printer ink cartridge', 'school bag kids', 'art supplies drawing', 'calculator scientific', 'whiteboard marker set', 'file folder organizer', 'stamp pad ink', 'pencil box kids', 'geometry box set'] },
];

// ═══════════════════════════════════════════════════
// ─── SCRAPER ENGINE (APILayer Advanced Scraper) ───
// ═══════════════════════════════════════════════════

function scrapeAmazonSearch(keyword) {
  return new Promise((resolve) => {
    // Amazon India search — sorted by popularity, no price filter (all price ranges)
    const amazonURL = `https://www.amazon.in/s?k=${encodeURIComponent(keyword)}&s=popularity-rank&i=aps`;
    const params = new URLSearchParams({
      url: amazonURL,
      country: 'in'
    });

    const options = {
      hostname: 'api.apilayer.com',
      path: `/adv_scraper/scraper?${params}`,
      method: 'GET',
      headers: { 'apikey': SCRAPER_KEY }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200 || !json.data) {
            console.log(`  ⚠️  Scraper error for "${keyword}":`, json.message || json.error || `HTTP ${res.statusCode}`);
            resolve([]);
            return;
          }
          const products = parseSearchResults(json.data);
          resolve(products);
        } catch (e) {
          console.log(`  ⚠️  Parse error for "${keyword}":`, e.message);
          resolve([]);
        }
      });
    });

    req.on('error', (e) => {
      console.log(`  ⚠️  Connection error for "${keyword}":`, e.message);
      resolve([]);
    });
    req.end();
  });
}

// ─── PARSE AMAZON SEARCH RESULTS HTML ───
function parseSearchResults(html) {
  const products = [];
  const seen = new Set();

  // Strategy: Find product title links — they contain the h2 with the full title
  // Structure: <a class="... s-line-clamp-2 ... a-text-normal" href="/Product/dp/ASIN/...">
  //              <h2 aria-label="FULL TITLE" class="... a-text-normal">
  //                <span>truncated title</span>
  //              </h2>
  //            </a>

  const titleRegex = /<h2[^>]*aria-label="([^"]+)"[^>]*class="[^"]*a-text-normal[^"]*"/g;
  let match;

  while ((match = titleRegex.exec(html)) !== null) {
    try {
      const title = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      if (!title || title.length < 15) continue;

      const titleIdx = match.index;

      // ── ASIN ── Look backward for the product link href containing /dp/ASIN
      const beforeTitle = html.substring(Math.max(0, titleIdx - 2000), titleIdx);
      const asinMatch = beforeTitle.match(/\/dp\/([A-Z0-9]{10})/);
      if (!asinMatch) continue;
      const asin = asinMatch[1];

      // Skip duplicates
      if (seen.has(asin)) continue;
      seen.add(asin);

      // ── Context chunks for data extraction ──
      // Price can be 5000-6000 chars after the title in Amazon's HTML
      const afterTitle = html.substring(titleIdx, titleIdx + 8000);
      // Also check the full product block (before + after) for price-to-pay
      const fullBlock = beforeTitle + afterTitle;

      // ── Price ── <span class="a-price-whole">1,299</span>
      let price = 0;
      const priceMatch = afterTitle.match(/class="a-price-whole">([^<]+)/);
      if (priceMatch) {
        price = parseInt(priceMatch[1].replace(/[,.\s]/g, ''));
      }
      if (!price) {
        // Fallback: a-offscreen with ₹
        const offMatch = afterTitle.match(/class="a-offscreen">₹\s*([\d,]+)/);
        if (offMatch) price = parseInt(offMatch[1].replace(/,/g, ''));
      }
      if (!price) {
        // Fallback: data-csa-c-price-to-pay attribute
        const ptpMatch = fullBlock.match(/price-to-pay="([0-9.]+)"/);
        if (ptpMatch) price = Math.round(parseFloat(ptpMatch[1]));
      }
      if (!price || price < 100) continue;

      // ── MRP / Was Price ── Inside <span class="a-price a-text-price">
      let was = 0;
      const wasMatch = afterTitle.match(/a-text-price[^>]*>.*?class="a-offscreen">₹?\s*([\d,]+)/s);
      if (wasMatch) {
        was = parseInt(wasMatch[1].replace(/,/g, ''));
      }
      if (!was) {
        // M.R.P. pattern
        const mrpMatch = afterTitle.match(/M\.R\.P\.?:?\s*(?:<[^>]+>)*\s*₹?\s*([\d,]+)/);
        if (mrpMatch) was = parseInt(mrpMatch[1].replace(/,/g, ''));
      }
      if (was <= price) was = 0;

      // ── Rating ── <span class="a-icon-alt">4.1 out of 5 stars</span>
      let rating = 0;
      const ratingMatch = afterTitle.match(/class="a-icon-alt">([0-9.]+)\s/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);

      // ── Reviews ── <span class="a-size-base s-underline-text">12,345</span>
      let reviews = 0;
      const reviewMatch = afterTitle.match(/class="a-size-base\s[^"]*s-underline-text[^"]*">([0-9,]+)/);
      if (reviewMatch) {
        reviews = parseInt(reviewMatch[1].replace(/,/g, ''));
      }
      if (!reviews) {
        // Fallback: any number after the rating section in a span
        const altReview = afterTitle.match(/aria-label="([0-9,]+)"/);
        if (altReview) reviews = parseInt(altReview[1].replace(/,/g, ''));
      }

      // ── Image ── Look backward from title for <img class="s-image" src="...">
      let image = '';
      const imgMatch = beforeTitle.match(/class="s-image"[^>]*src="([^"]+)"/);
      if (imgMatch) image = imgMatch[1];
      if (!image) {
        // Try forward
        const fwdImg = afterTitle.match(/class="s-image"[^>]*src="([^"]+)"/);
        if (fwdImg) image = fwdImg[1];
      }

      products.push({
        asin,
        title,
        price,
        was,
        rating: rating || 4.0,
        reviews: reviews || 0,
        image
      });

    } catch (e) {
      continue;
    }
  }

  return products;
}


// ═══════════════════════════════════════════════════
// ─── FIRESTORE REST API ───
// ═══════════════════════════════════════════════════

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
        // Top-level img field for frontend fallback
        img: { stringValue: product.images[0] || '' },
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

// ═══════════════════════════════════════════════════
// ─── SUBCATEGORY DETECTION (mirrors app.js SUBCATEGORIES) ───
// ═══════════════════════════════════════════════════
function detectSubcategory(name, cat) {
  const text = name.toLowerCase();

  // ── FASHION ──
  // Subcats: Men's/Women's Footwear, Western Wear, Ethnic Wear, Sportswear, Accessories, Kids Wear
  if (cat === 'fashion') {
    let gender = '';
    if (/\bkids|children|infant|school/.test(text)) gender = 'Kids';
    else if (text.includes('unisex')) gender = 'Unisex';
    // IMPORTANT: Check women BEFORE men — 'women' contains 'men'!
    else if (/\bwomen|ladies|\bgirl\b|female/.test(text)) gender = "Women's";
    else if (/\bmen('s|\s|$)|\bboy\b/.test(text) || text.includes('male')) gender = "Men's";

    // Skip non-fashion items that sometimes appear in fashion searches
    if (/\bpencil.?case|stationery|pen.?stand|eraser|ruler\b/.test(text)) return 'Accessories';

    let type = '';
    if (/\b(shoe|sneaker|sandal|slipper|boot|heel|loafer|floater|flip.?flop|croc|moccasin)\b/.test(text)) type = 'Footwear';
    else if (/\b(kurta|saree|lehenga|ethnic|sherwani|salwar|dupatta|anarkali|dhoti|lungi|churidar)\b/.test(text)) type = 'Ethnic Wear';
    else if (/\b(jeans|denim|shirt|t-?shirt|tshirt|jacket|dress|top|shorts|hoodie|blazer|trouser|pant|skirt|sweater|cardigan|coat|pullover|polo)\b/.test(text)) type = 'Western Wear';
    else if (/\b(sport|gym|track|yoga|running|athletic|workout|fitness|jogger)\b/.test(text)) type = 'Sportswear';
    else if (/\b(watch|bag|wallet|belt|cap|hat|scarf|stole|ring|bracelet|earring|necklace|sunglass|backpack|purse|clutch|case)\b/.test(text)) type = 'Accessories';

    if (gender === 'Kids') return 'Kids Wear';
    if (gender && type) return gender + ' ' + type;
    if (type) return (gender || "Men's") + ' ' + type;
    if (gender) return gender + ' Western Wear';
    return "Men's Western Wear"; // fallback
  }

  // ── BEAUTY ──
  // Subcats: Women's/Men's Skincare, Haircare, Fragrance, Makeup, Nails, Tools & Brushes
  if (cat === 'beauty') {
    let g = /\bmen('s|\s|$)|\bmale|\bbeard/.test(text) ? "Men's" : "Women's";
    if (/\bserum|moisturiz|sunscreen|face wash|face cream|lotion|cleanser|toner|spf|uv\b/.test(text)) return g + ' Skincare';
    if (/\bshampoo|conditioner|hair oil|hair mask|anti.?frizz|hair growth|hair fall|scalp/.test(text)) return g + ' Haircare';
    if (/\bperfume|fragrance|deodorant|body mist|cologne|attar|eau de/.test(text)) return g + ' Fragrance';
    if (/\blipstick|foundation|mascara|kajal|eyeliner|concealer|makeup|blush|primer|compact|eye.?shadow/.test(text)) return 'Makeup';
    if (/\bnail|manicure|pedicure/.test(text)) return 'Nails';
    if (/\bbrush|sponge|tool|applicator|curler|straighten|dryer|iron/.test(text)) return 'Tools & Brushes';
    if (/\bessential.?oil|aroma/.test(text)) return "Women's Skincare";
    return g + ' Skincare'; // fallback
  }

  // ── HOME & LIVING ──
  // Subcats: Cookware, Kitchen Appliances, Home Decor, Furniture, Storage & Organization, Bedding & Linen, Cleaning, Lighting, Garden & Outdoor
  if (cat === 'home') {
    if (/\bpan|kadai|tawa|cookware|cooker|pot|wok|skillet|saucepan|frying/.test(text)) return 'Cookware';
    if (/\bmixer|grinder|blender|toaster|kettle|oven|microwave|induction|juicer|chopper|food processor|rice cooker|air fryer/.test(text)) return 'Kitchen Appliances';
    if (/\bdecor|wall.?art|painting|showpiece|vase|clock|frame|idol|statue|candle|artificial.?flower/.test(text)) return 'Home Decor';
    if (/\bbedsheet|pillow|curtain|blanket|comforter|mattress|duvet|towel|linen|quilt/.test(text)) return 'Bedding & Linen';
    if (/\bvacuum|mop|broom|cleaning|wiper|duster|scrub|detergent/.test(text)) return 'Cleaning Supplies';
    if (/\blamp|light|led|bulb|chandelier|fairy.?light|torch|lantern|strip.?light/.test(text)) return 'Lighting';
    if (/\btable|chair|shelf|desk|sofa|cabinet|rack|stand|stool|bookcase|wardrobe/.test(text)) return 'Furniture';
    if (/\bstorage|organiz|box|basket|container|bin|drawer|hook|hanger/.test(text)) return 'Storage & Organization';
    if (/\bgarden|plant|planter|lawn|outdoor|sprinkler|hose|pot|seed|compost/.test(text)) return 'Garden & Outdoor';
    if (/\bmug|cup|bottle|flask|tumbler|plate|bowl|spoon|fork|knife|tray|cutting.?board|lunch.?box/.test(text)) return 'Cookware';
    return 'Home Decor'; // fallback
  }

  // ── ELECTRONICS ──
  // Subcats: Smartphones, Laptops & Computers, Wired/Wireless Headphones, Smartwatches, Bluetooth Speakers, Cameras, Chargers & Cables, Power Banks, Smart Home
  if (cat === 'electronics') {
    // Check specific device types FIRST to avoid false matches
    if (/\bsmartwatch|smart.?watch|fitness.?band|fitness.?track/.test(text)) return 'Smartwatches';
    if (/\bpower.?bank|portable.?charger/.test(text)) return 'Power Banks';
    if (/\blaptop|computer|desktop|monitor|keyboard|mouse|touchpad|notebook|chromebook|macbook/.test(text)) return 'Laptops & Computers';
    if (/\btablet|ipad|kindle|e-?reader/.test(text)) return 'Laptops & Computers';
    if (/\bphone|mobile|smartphone|iphone|samsung|redmi|realme|oneplus|poco|vivo|oppo/.test(text)) return 'Smartphones';
    if (/\bcamera|gopro|webcam|dslr|tripod|ring.?light|gimbal|drone/.test(text)) return 'Cameras';
    if (/\balexa|echo|smart.?plug|smart.?bulb|smart.?home|google.?home|smart.?switch|wifi.?cam|security.?cam/.test(text)) return 'Smart Home';
    if (/\brouter|wifi|modem|extender|mesh/.test(text)) return 'Smart Home';
    if (/\bspeaker|soundbar|subwoofer|boombox/.test(text)) return 'Bluetooth Speakers';
    // Audio — check AFTER devices so mouse/keyboard/tablet don't match 'wireless'
    if (/\bearbuds|\bearphones|\bheadphones|\btws|\bneckband|\bairpod|\bbuds\b|noise.?cancell/.test(text)) {
      return /\bwired\b/.test(text) && !/wireless|bluetooth/.test(text) ? 'Wired Headphones' : 'Wireless Headphones';
    }
    if (/\bcharger|cable|adapter|usb|type.?c|lightning|dock|hub/.test(text)) return 'Chargers & Cables';
    return 'Chargers & Cables'; // fallback
  }

  // ── BOOKS & TOYS ──
  // Subcats: Fiction, Non-Fiction, Self-Help, Educational, Kids Books, Action Toys, Board Games, Puzzles
  if (cat === 'books') {
    // Toys & Collectibles first (since they search under 'books' category)
    if (/\baction.?figure|figurine|doll|toy.?car|robot|superhero|marvel|dc.?comics|star.?wars|transformer|lego|nerf|hot.?wheel/.test(text)) return 'Action Toys';
    if (/\bfunko|pop!|vinyl.?figure|collectible.?figure|bobble.?head|schleich|bendable.?figure/.test(text)) return 'Action Toys';
    if (/\bboard.?game|monopoly|chess|card.?game|scrabble|uno|ludo|carrom|catan|family.?game/.test(text)) return 'Board Games';
    if (/\bpuzzle|jigsaw|rubik|brain.?teas|cribbage/.test(text)) return 'Board Games';
    if (/\btoy|building.?block|play.?set|remote.?control|rc\s|soft.?toy|teddy|stuffed|plush|play.?doh|craft|slime|nerf/.test(text)) return 'Action Toys';
    // Books
    if (/\bfiction|novel|story|thriller|mystery|romance|adventure|fantasy|horror/.test(text)) return 'Fiction';
    if (/\bself.?help|motivat|habit|mindset|atomic|success|leadership|productiv|goal/.test(text)) return 'Self-Help';
    if (/\bbiograph|histor|non.?fiction|memoir|autobiograph|politic|science|philosophy/.test(text)) return 'Non-Fiction';
    if (/\bkid|children|coloring|colour|nursery|bedtime|fairy|rhyme|baby.?book|picture.?book/.test(text)) return 'Kids Books';
    if (/\beducat|textbook|exam|ncert|upsc|ssc|study|guide|grammar|math|class\s?\d/.test(text)) return 'Educational';
    if (/\bcookbook|recipe/.test(text)) return 'Non-Fiction';
    if (/\bplanner|journal|diary|notebook/.test(text)) return 'Self-Help';
    if (/\bfigure|character|creature|bull|moose/.test(text)) return 'Action Toys';
    return 'Non-Fiction'; // fallback
  }

  // ── PERSONAL CARE ──
  // Subcats: Men's Grooming, Women's Hygiene, Oral Care, Women's/Men's Hair Care, Body Care, Health & Wellness
  if (cat === 'personal') {
    if (/\btrimmer|razor|shaving|beard|after.?shave|grooming.?kit/.test(text)) return "Men's Grooming";
    if (/\bshampoo|conditioner|hair.?oil|hair.?mask|anti.?dandruff|hair.?fall|scalp/.test(text)) {
      return (/\bmen|male|beard/.test(text) ? "Men's" : "Women's") + ' Hair Care';
    }
    if (/\btoothpaste|toothbrush|oral|mouthwash|floss|dental|tongue.?clean/.test(text)) return 'Oral Care';
    if (/\bbody.?wash|shower.?gel|soap|lotion|body.?cream|moisturiz|scrub|body.?oil/.test(text)) return 'Body Care';
    if (/\bpad|tampon|hygiene|intimate.?wash|menstrual|feminine/.test(text)) return "Women's Hygiene";
    if (/\bvitamin|supplement|protein|health|wellness|omega|calcium|iron|biotin|collagen|probiotic|immunity|ayurved|weight.?loss|weight.?gain|whey|bcaa|creatine/.test(text)) return 'Health & Wellness';
    if (/\byoga|gym|fitness|exercise|workout|mat|skipping|dumbbell|resistance|massage/.test(text)) return 'Health & Wellness';
    if (/\bface.?razor|epilator|wax/.test(text)) return "Women's Hygiene";
    return 'Body Care'; // fallback
  }

  // ── BABY PRODUCTS ──
  // Subcats: Baby Boy Clothing, Baby Girl Clothing, Feeding Essentials, Diapers & Wipes, Baby Toys, Bath & Skin Care, Gear & Safety
  if (cat === 'baby') {
    if (/\bboy.?(cloth|dress|outfit|romper|set)|boy.?t-?shirt/.test(text)) return 'Baby Boy Clothing';
    if (/\bgirl.?(cloth|dress|outfit|romper|frock)|girl.?t-?shirt/.test(text)) return 'Baby Girl Clothing';
    if (/\bdiaper|wipe|nappy|pull.?up/.test(text)) return 'Diapers & Wipes';
    if (/\btoy|rattle|teether|play|musical|learning/.test(text)) return 'Baby Toys';
    if (/\bbottle|feed|sippy|cup|nipple|formula|cereal|food|bib/.test(text)) return 'Feeding Essentials';
    if (/\bbath|soap|lotion|oil|cream|powder|skin|body.?wash|shampoo/.test(text)) return 'Bath & Skin Care';
    if (/\bstroller|carrier|car.?seat|walker|bouncer|swing|crib|cradle|gate|monitor|swaddle|blanket|mosquito|mat/.test(text)) return 'Gear & Safety';
    if (/\bcloth|romper|onesie|set|bodysuit|outfit/.test(text)) return 'Baby Boy Clothing';
    return 'Gear & Safety'; // fallback
  }

  // ── PET SUPPLIES ──
  // Subcats: Dog Food/Accessories, Cat Food/Accessories, Fish & Aquarium, Bird Supplies, Pet Grooming
  if (cat === 'pets') {
    if (/\bdog/.test(text)) return /\bfood|treat|biscuit|kibble|chew.?stick/.test(text) ? 'Dog Food' : 'Dog Accessories';
    if (/\bcat|kitten/.test(text)) return /\bfood|treat|kibble/.test(text) ? 'Cat Food' : 'Cat Accessories';
    if (/\bfish|aquarium|tank|filter|pump|gravel|substrate/.test(text)) return 'Fish & Aquarium';
    if (/\bbird|parrot|cage|perch|finch|budgie/.test(text)) return 'Bird Supplies';
    if (/\bgroom|brush|shampoo|nail.?clip|comb|dryer/.test(text)) return 'Pet Grooming';
    if (/\bpet/.test(text)) return 'Pet Grooming';
    return 'Dog Accessories'; // fallback
  }

  // ── SPORTS & FITNESS ──
  if (cat === 'sports') {
    if (/\bcricket|bat|wicket|stump|pad|guard/.test(text)) return 'Cricket';
    if (/\bfootball|soccer|fifa|goal.?keep/.test(text)) return 'Football';
    if (/\bbadminton|shuttlecock|racket|racquet/.test(text)) return 'Badminton';
    if (/\bdumbbell|barbell|bench.?press|weight|kettlebell|pull.?up|push.?up|gym/.test(text)) return 'Gym Equipment';
    if (/\byoga|meditation|pilates|stretching|foam.?roller/.test(text)) return 'Yoga & Meditation';
    if (/\brunning|jogging|walking|marathon|treadmill/.test(text)) return 'Running & Walking';
    if (/\bcycl|bike|bicycle|helmet/.test(text)) return 'Cycling';
    if (/\bswim|pool|goggles|swim.?cap/.test(text)) return 'Swimming';
    if (/\bprotein|bcaa|creatine|pre.?workout|supplement|whey|nutrition/.test(text)) return 'Sports Nutrition';
    if (/\btable.?tennis|ping.?pong/.test(text)) return 'Badminton';
    if (/\bbox|punch|glove|martial/.test(text)) return 'Gym Equipment';
    if (/\bskip|rope|band|resistance|exercise/.test(text)) return 'Gym Equipment';
    if (/\bsport|athletic|fitness/.test(text)) return 'Gym Equipment';
    return 'Gym Equipment'; // fallback
  }

  // ── GROCERIES & GOURMET ──
  if (cat === 'grocery') {
    if (/\bsnack|biscuit|chip|namkeen|cookie|cracker|munch/.test(text)) return 'Snacks & Biscuits';
    if (/\btea|coffee|juice|drink|water|beverage|soda|shake/.test(text)) return 'Beverages';
    if (/\boil|ghee|atta|flour|rice|dal|salt|sugar|vinegar/.test(text)) return 'Cooking Essentials';
    if (/\bdry.?fruit|almond|cashew|walnut|pistachio|raisin|nut|seed|trail.?mix/.test(text)) return 'Dry Fruits & Nuts';
    if (/\boat|muesli|granola|protein|health|diet|low.?cal|sugar.?free/.test(text)) return 'Health Foods';
    if (/\bspice|masala|turmeric|cumin|pepper|chilli|cinnamon|cardamom/.test(text)) return 'Spices & Masala';
    if (/\bchocolate|candy|sweet|mithai|laddu|barfi/.test(text)) return 'Chocolates & Sweets';
    if (/\borganic|natural|pure|herbal|ayurved/.test(text)) return 'Organic & Natural';
    if (/\bhoney|jaggery|jam|spread|peanut.?butter/.test(text)) return 'Health Foods';
    return 'Cooking Essentials'; // fallback
  }

  // ── AUTOMOTIVE ──
  if (cat === 'auto') {
    if (/\bcar\b.*\b(accessor|cover|seat|cushion|mat|mirror|visor|sunshade|organiz)/.test(text)) return 'Car Accessories';
    if (/\bbike\b.*\b(accessor|glove|tank|cover|lock|chain|handlebar)/.test(text)) return 'Bike Accessories';
    if (/\bdash.?cam|gps|charger|bluetooth|music|stereo|speaker|led|light|camera/.test(text)) return 'Car Electronics';
    if (/\bhelmet|guard|jacket|vest|reflective|safety|knee/.test(text)) return 'Helmet & Safety';
    if (/\bwash|clean|polish|wax|shampoo|duster|vacuum|microfiber|sponge/.test(text)) return 'Car Care';
    if (/\btool|jack|wrench|inflat|compressor|pump|repair|kit/.test(text)) return 'Tools & Equipment';
    if (/\bcar\b/.test(text)) return 'Car Accessories';
    if (/\bbike|motorcycle|scooter/.test(text)) return 'Bike Accessories';
    if (/\bphone.*holder|mobile.*holder|mount/.test(text)) return 'Car Electronics';
    return 'Car Accessories'; // fallback
  }

  // ── OFFICE & STATIONERY ──
  if (cat === 'office') {
    if (/\bpen\b|ballpoint|fountain|gel.?pen|roller.?ball|ink.?pen|marker|highlighter/.test(text)) return 'Pens & Writing';
    if (/\bnotebook|diary|journal|planner|register|ruled|unruled/.test(text)) return 'Notebooks & Diaries';
    if (/\bdesk|organiz|tray|holder|stand|paper.?weight|table|file|folder/.test(text)) return 'Desk Organizers';
    if (/\bprinter|cartridge|ink|toner|scanner|paper|a4/.test(text)) return 'Printers & Ink';
    if (/\bschool|bag|backpack|lunch|water.?bottle|compass|geometry|pencil.?box|eraser|ruler|sharpener/.test(text)) return 'School Supplies';
    if (/\bart|paint|brush|canvas|sketch|drawing|crayon|colour|color|pastel|easel/.test(text)) return 'Art Supplies';
    if (/\bcalculator|stapler|tape|glue|scissor|cutter|stamp|punch|laminator|whiteboard/.test(text)) return 'School Supplies';
    return 'School Supplies'; // fallback
  }

  return '';
}

// ═══════════════════════════════════════════════════
// ─── UPGRADE IMAGE URL ───
// ═══════════════════════════════════════════════════
function upgradeImageURL(url) {
  // Amazon search thumbnails are small; upgrade to large resolution
  // Replace ._AC_UL320_ or similar suffixes with ._AC_SL1500_
  return url.replace(/\._[A-Z]{2}_[^.]+_\./, '._AC_SL1500_.');
}

// ═══════════════════════════════════════════════════
// ─── MAIN ───
// ═══════════════════════════════════════════════════
async function main() {
  console.log('\n🚀 DealKart Auto-Deal Finder (Scraper Edition)');
  console.log('═'.repeat(55));
  console.log('   🔧 Engine: APILayer Advanced Scraper');
  console.log(`   🏷️  Partner Tag: ${PARTNER_TAG}`);
  console.log(`   🔑 Scraper Key: ${SCRAPER_KEY.substring(0, 8)}...`);

  // Get existing ASINs to avoid duplicates
  console.log('\n📦 Checking existing products...');
  const existingASINs = await getExistingASINs();
  console.log(`   Found ${existingASINs.size} existing products\n`);

  let totalAdded = 0;
  let totalSkipped = 0;
  let totalScraped = 0;

  // ─── CATEGORY ROTATION ───
  // Run ~5 categories per cycle, rotate based on hour
  const hour = new Date().getHours();
  const rotationIndex = Math.floor(hour / 6) % 2;
  const categoriesToRun = SEARCH_QUERIES.filter((_, i) => i % 2 === rotationIndex);
  console.log(`📋 Running ${categoriesToRun.length} of ${SEARCH_QUERIES.length} categories this cycle (rotation ${rotationIndex})\n`);

  for (const catConfig of categoriesToRun) {
    console.log(`\n🏷️  ${catConfig.cat.toUpperCase()}`);

    // Pick 2 random keywords per category (conserve API quota)
    const shuffled = catConfig.keywords.sort(() => Math.random() - 0.5);
    const selectedKeywords = shuffled.slice(0, 2);

    for (const keyword of selectedKeywords) {
      console.log(`   🔍 Scraping: "${keyword}"...`);

      const rawProducts = await scrapeAmazonSearch(keyword);
      totalScraped += rawProducts.length;
      console.log(`   📋 Scraped ${rawProducts.length} products from search results`);

      for (const raw of rawProducts) {
        // Skip if already exists
        if (existingASINs.has(raw.asin)) {
          totalSkipped++;
          continue;
        }

        // Skip bad data
        if (!raw.title || raw.price < 100 || !raw.image) continue;

        // Skip low ratings
        if (raw.rating < 4.0) continue;

        // Calculate discount (need at least 20% off to be a real deal)
        const discount = raw.was > 0 ? ((raw.was - raw.price) / raw.was * 100) : 0;
        if (discount < 20) continue;

        // Build product object matching Firestore schema
        const product = {
          name: raw.title,
          cat: catConfig.cat,
          subcat: detectSubcategory(raw.title, catConfig.cat),
          price: raw.price,
          was: raw.was,
          rating: raw.rating,
          reviews: raw.reviews,
          images: [upgradeImageURL(raw.image)],
          link: `https://www.amazon.in/dp/${raw.asin}?tag=${PARTNER_TAG}`,
          asin: raw.asin
        };

        // Add to Firestore
        const success = await addToFirestore(product);
        if (success) {
          existingASINs.add(raw.asin);
          totalAdded++;
          console.log(`   ✅ Added: ${product.name.substring(0, 50)}... (₹${product.price}, ${Math.round(discount)}% off) → ${product.subcat || 'No subcat'}`);
        }
      }

      // Rate limit: wait between scrapes (scraper API has limits)
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '═'.repeat(55));
  console.log(`✅ Scraping done! ${totalScraped} products found.`);
  console.log(`   ➕ Added ${totalAdded} new deals`);
  console.log(`   ⏩ Skipped ${totalSkipped} duplicates`);
  console.log('═'.repeat(55));

  // ─── REPAIR SUBCATEGORIES on existing products ───
  console.log('\n🔧 Repairing subcategories on existing products...');
  await repairSubcategories();

  // ─── LIVE PRICE CHECK on existing products ───
  console.log('\n🔄 Running live price check on existing products...');
  await refreshPrices();

  console.log('\n✅ All done!\n');
}

// ═══════════════════════════════════════════════════
// ─── SUBCATEGORY REPAIR ───
// Re-runs detectSubcategory on all existing products and patches mismatches
// ═══════════════════════════════════════════════════

async function repairSubcategories() {
  return new Promise((resolve) => {
    let url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300`;

    function fetchAndRepair(pageUrl, repaired = 0, checked = 0) {
      https.get(pageUrl, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', async () => {
          try {
            const json = JSON.parse(data);
            const docs = json.documents || [];

            for (const doc of docs) {
              const fields = doc.fields || {};
              const name = fields.name?.stringValue || '';
              const cat = fields.cat?.stringValue || '';
              const oldSubcat = fields.subcat?.stringValue || '';

              if (!name || !cat) continue;
              checked++;

              const newSubcat = detectSubcategory(name, cat);
              if (newSubcat && newSubcat !== oldSubcat) {
                // Patch subcat in Firestore
                const relativePath = doc.name.split('/documents/')[1];
                if (!relativePath) continue;

                const body = JSON.stringify({
                  fields: { subcat: { stringValue: newSubcat } }
                });
                const patchDone = await new Promise((res2) => {
                  const options = {
                    hostname: 'firestore.googleapis.com',
                    path: `/v1/projects/${FB_PROJECT}/databases/(default)/documents/${relativePath}?updateMask.fieldPaths=subcat`,
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
                  };
                  const req = https.request(options, (r) => {
                    let d = '';
                    r.on('data', c => d += c);
                    r.on('end', () => res2(r.statusCode === 200));
                  });
                  req.on('error', () => res2(false));
                  req.write(body);
                  req.end();
                });

                if (patchDone) {
                  repaired++;
                  console.log(`   🔄 ${name.substring(0, 45)}... "${oldSubcat}" → "${newSubcat}"`);
                }
              }
            }

            if (json.nextPageToken) {
              const nextUrl = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/products?pageSize=300&pageToken=${json.nextPageToken}`;
              fetchAndRepair(nextUrl, repaired, checked);
            } else {
              console.log(`   📊 Checked ${checked} products, repaired ${repaired} subcategories`);
              resolve();
            }
          } catch (e) {
            console.log(`   ⚠️ Repair error:`, e.message);
            resolve();
          }
        });
      }).on('error', () => resolve());
    }

    fetchAndRepair(url);
  });
}

// ═══════════════════════════════════════════════════
// ─── LIVE PRICE REFRESH ───
// Scrapes each product's Amazon page and updates Firestore
// ═══════════════════════════════════════════════════

async function getExistingProducts() {
  return new Promise((resolve) => {
    const products = [];

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
              const fields = doc.fields || {};
              const link = fields.link?.stringValue || '';
              const asinMatch = link.match(/\/dp\/([A-Z0-9]{10})/i);
              if (!asinMatch) return;

              products.push({
                docPath: doc.name, // full Firestore path
                asin: asinMatch[1],
                name: fields.name?.stringValue || '',
                price: parseInt(fields.price?.integerValue || '0'),
                was: parseInt(fields.was?.integerValue || '0'),
                active: fields.active?.booleanValue !== false
              });
            });

            if (json.nextPageToken) {
              fetchPage(json.nextPageToken);
            } else {
              resolve(products);
            }
          } catch (e) { resolve(products); }
        });
      }).on('error', () => resolve(products));
    }

    fetchPage();
  });
}

function scrapeProductPrice(asin) {
  return new Promise((resolve) => {
    const amazonURL = `https://www.amazon.in/dp/${asin}`;
    const params = new URLSearchParams({ url: amazonURL, country: 'in' });

    const options = {
      hostname: 'api.apilayer.com',
      path: `/adv_scraper/scraper?${params}`,
      method: 'GET',
      headers: { 'apikey': SCRAPER_KEY }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200 || !json.data) {
            resolve(null);
            return;
          }

          const html = json.data;

          // Extract current price from product page
          let price = 0;
          const priceMatch = html.match(/class="a-price-whole">([^<]+)/);
          if (priceMatch) price = parseInt(priceMatch[1].replace(/[,.\s]/g, ''));
          if (!price) {
            const offMatch = html.match(/class="a-offscreen">₹\s*([\d,]+)/);
            if (offMatch) price = parseInt(offMatch[1].replace(/,/g, ''));
          }

          // Extract MRP
          let was = 0;
          const wasMatch = html.match(/a-text-price[^>]*>.*?class="a-offscreen">₹?\s*([\d,]+)/s);
          if (wasMatch) was = parseInt(wasMatch[1].replace(/,/g, ''));
          if (was <= price) was = 0;

          // Check if product is unavailable
          const unavailable = /currently unavailable|not available/i.test(html);

          resolve({ price, was, unavailable });
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function updateProductPrice(docPath, price, was) {
  return new Promise((resolve) => {
    // Extract the relative path from the full document path
    const relativePath = docPath.split('/documents/')[1];
    if (!relativePath) { resolve(false); return; }

    const updateObj = {
      fields: {
        price: { integerValue: String(price) },
        was: { integerValue: String(was) },
        priceUpdatedAt: { timestampValue: new Date().toISOString() }
      }
    };

    const body = JSON.stringify(updateObj);
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${FB_PROJECT}/databases/(default)/documents/${relativePath}?updateMask.fieldPaths=price&updateMask.fieldPaths=was&updateMask.fieldPaths=priceUpdatedAt`,
      method: 'PATCH',
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

function deactivateProduct(docPath) {
  return new Promise((resolve) => {
    const relativePath = docPath.split('/documents/')[1];
    if (!relativePath) { resolve(false); return; }

    const body = JSON.stringify({ fields: { active: { booleanValue: false } } });
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${FB_PROJECT}/databases/(default)/documents/${relativePath}?updateMask.fieldPaths=active`,
      method: 'PATCH',
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

async function refreshPrices() {
  const products = await getExistingProducts();
  const activeProducts = products.filter(p => p.active);
  console.log(`   📦 Found ${activeProducts.length} active products to check`);

  // Check up to 10 products per cycle (conserve API quota)
  // Pick the oldest-updated or random selection
  const toCheck = activeProducts.sort(() => Math.random() - 0.5).slice(0, 10);

  let updated = 0;
  let deactivated = 0;
  let unchanged = 0;

  for (const product of toCheck) {
    const priceData = await scrapeProductPrice(product.asin);

    if (!priceData) {
      unchanged++;
      continue;
    }

    if (priceData.unavailable) {
      // Product no longer available — hide it
      await deactivateProduct(product.docPath);
      deactivated++;
      console.log(`   ❌ Deactivated: ${product.name.substring(0, 40)}... (unavailable)`);
      continue;
    }

    if (priceData.price > 0 && priceData.price !== product.price) {
      const oldPrice = product.price;
      await updateProductPrice(product.docPath, priceData.price, priceData.was || product.was);
      updated++;
      const arrow = priceData.price < oldPrice ? '📉' : '📈';
      console.log(`   ${arrow} Updated: ${product.name.substring(0, 40)}... ₹${oldPrice} → ₹${priceData.price}`);
    } else {
      unchanged++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`   📊 Price check: ${updated} updated, ${deactivated} deactivated, ${unchanged} unchanged`);
}

main().catch(console.error);
