/*  ═══════════════════════════════════════════════════
    DealKart India — Auto-Deal Finder (Scraper Edition)
    Uses Scrape.do to get REAL prices from Amazon India
    — no PA-API Offers restriction!
    Run: node auto-deals.js
═══════════════════════════════════════════════════ */

require('dotenv').config();
const https = require('https');

// ─── CONFIG ───
const PARTNER_TAG    = process.env.AMAZON_PARTNER_TAG || 'sandeepku0b19-21';
const SCRAPER_TOKEN  = process.env.SCRAPEDO_TOKEN || '63b971431919467c9922b63fb868d335c9336d8c28e';
const FB_PROJECT     = process.env.FIREBASE_PROJECT_ID;

// Keep PA-API credentials for potential fallback
const ACCESS_KEY     = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY     = process.env.AMAZON_SECRET_KEY;
const PA_API_HOST    = 'webservices.amazon.in';
const PA_API_REGION  = 'eu-west-1';

// ─── SEARCH QUERIES BY CATEGORY (Bestsellers Focus) ───
const SEARCH_QUERIES = [
  // ══ FASHION — Men's/Women's Clothing, Footwear, Ethnic, Kids, Watches, Handbags, Sportswear ══
  { cat: 'fashion', keywords: ['mens tshirt combo pack bestseller', 'women western dress trending', 'mens running shoes bestseller', 'women heels sandals trending', 'men kurta pajama set', 'women saree silk bestseller', 'kids clothing set boys girls', 'smartwatch men fastrack titan', 'women handbag sling bag', 'sports shoes men gym', 'mens jeans slim fit stretch', 'women leggings cotton combo', 'mens formal shirt office', 'women kurti palazzo set', 'kids shoes boys school', 'mens wallet leather branded', 'women sneakers white', 'sunglasses men women polarized', 'men joggers trackpants combo', 'women lehenga wedding party'] },

  // ══ BEAUTY — Skin Care, Hair Care, Make-up, Fragrance, Nails, Beauty Tools, Bath & Body, Men's Grooming ══
  { cat: 'beauty', keywords: ['vitamin c serum face bestselling', 'lipstick matte long lasting set', 'sunscreen spf 50 face body', 'hair oil growth bestselling', 'perfume women long lasting branded', 'men perfume eau de parfum', 'foundation full coverage waterproof', 'kajal waterproof smudge proof', 'nail polish gel set', 'hair straightener flat iron', 'makeup brush set professional', 'face wash oily skin bestseller', 'moisturizer cream dry skin', 'beard oil men growth', 'bath body wash shower gel', 'hair serum anti frizz women', 'men grooming kit trimmer', 'eye shadow palette shimmer'] },

  // ══ HOME & KITCHEN — Kitchen & Dining, Appliances, Decor, Furniture, Bedding, Storage, Cleaning, Lighting, Garden ══
  { cat: 'home', keywords: ['non stick cookware set bestseller', 'mixer grinder juicer bestseller', 'wall art painting home decor', 'bedsheet double bed cotton king', 'vacuum cleaner home bestseller', 'led bulb smart philips', 'water bottle steel flask thermos', 'office chair ergonomic bestseller', 'curtains blackout living room', 'air fryer bestseller home', 'storage organizer wardrobe closet', 'cushion cover sofa set', 'wall clock decorative modern', 'garden tools kit set outdoor', 'kitchen rack steel organizer', 'dinner set ceramic plates bowls', 'pressure cooker 5 litre steel', 'fairy lights decoration room string'] },

  // ══ ELECTRONICS — Mobiles, Laptops, Headphones, Speakers, Smart Watches, Cameras, Chargers, Power Banks, Smart Home, Tablets ══
  { cat: 'electronics', keywords: ['wireless earbuds bluetooth bestseller', 'smartwatch fitness tracker bestseller', 'power bank 20000mah fast charging', 'bluetooth speaker jbl portable', 'fast charger type c 65w', 'laptop under 30000 bestseller', 'smartphone under 15000 5g', 'security camera wifi 360', 'tablet android 10 inch bestseller', 'gaming mouse rgb bestseller', 'wired earphones with mic bass', 'smart plug wifi alexa', 'usb c hub multiport adapter', 'webcam 1080p laptop hd', 'smart bulb led wifi color', 'action camera waterproof 4k', 'headphones over ear wireless', 'drone camera 4k gps'] },

  // ══ BOOKS — Fiction, Non-Fiction, Self-Help, Academic, Children's Books ══
  { cat: 'books', keywords: ['fiction novel bestseller 2024', 'self help book bestseller motivational', 'ncert textbook class 10 12', 'children story book illustrated', 'biography autobiography bestseller', 'indian cookbook recipes bestseller', 'stock market investing beginner', 'upsc preparation book set', 'motivational book atomic habits', 'english grammar book learning', 'hindi novel bestseller', 'psychology book bestseller mind', 'coloring activity book kids', 'competitive exam book ssc bank'] },

  // ══ TOYS & GAMES (under 'books' cat) — Action Figures, Board Games, Puzzles ══
  { cat: 'books', keywords: ['action figure marvel avengers', 'board game family monopoly', 'puzzle 1000 pieces adults', 'building blocks lego kids', 'remote control car kids rechargeable', 'soft toys teddy bear large', 'learning toy kids educational', 'art craft kit kids set', 'chess board wooden magnetic', 'card game uno family', 'hot wheels cars set track', 'nerf gun blaster bestseller'] },

  // ══ HEALTH & PERSONAL CARE — Men's Grooming, Women's Hygiene, Oral Care, Hair Care, Body Care, Vitamins, Nutrition ══
  { cat: 'personal', keywords: ['trimmer men philips bestseller', 'electric toothbrush oral b', 'shampoo anti dandruff bestseller', 'body wash shower gel men women', 'multivitamin tablets daily men women', 'whey protein powder bestseller', 'beard trimmer men professional', 'intimate wash women bestseller', 'mouthwash listerine antiseptic', 'body lotion winter dry skin', 'hair oil coconut amla', 'biotin supplements hair growth', 'collagen powder supplements skin', 'face razor women eyebrow', 'vitamin d3 calcium tablets', 'weight gainer protein shake'] },

  // ══ BABY — Clothing, Feeding, Diapering, Toys, Care, Strollers, Safety ══
  { cat: 'baby', keywords: ['baby diaper pants bestseller', 'baby toys 6-12 months rattle', 'feeding bottle anti colic newborn', 'baby lotion cream skincare set', 'baby stroller pram lightweight', 'baby wipes sensitive organic', 'baby carrier ergonomic kangaroo', 'baby boy clothes romper set', 'baby girl dress frock party', 'baby bath tub newborn foldable', 'muslin swaddle blanket organic', 'baby gate safety stairs', 'baby food cereal organic', 'teether silicone bpa free'] },

  // ══ PET SUPPLIES — Dogs, Cats, Fish & Aquatics, Birds, Pet Grooming ══
  { cat: 'pets', keywords: ['dog food pedigree drools', 'dog collar harness leash walk', 'cat food whiskas temptations', 'cat toy interactive ball mouse', 'aquarium fish tank filter pump', 'bird cage large parrot finch', 'dog bed washable large orthopedic', 'cat litter tray box enclosed', 'pet grooming brush glove comb', 'dog chew bone toy treat', 'cat scratching post tree tower', 'fish food pellets flakes tropical', 'dog shampoo anti tick flea', 'pet carrier bag travel airline'] },

  // ══ SPORTS, FITNESS & OUTDOORS — Cricket, Football, Badminton, Gym, Yoga, Running, Cycling, Swimming, Nutrition ══
  { cat: 'sports', keywords: ['cricket bat english willow kashmir', 'football shoes men adidas nike', 'badminton racket yonex li ning', 'dumbbells adjustable set home gym', 'yoga mat 6mm thick exercise', 'running shoes men cushioned', 'cycling helmet gloves accessories', 'swimming goggles cap set', 'whey protein isolate bestseller', 'gym gloves wrist support men', 'cricket ball leather kookaburra', 'resistance bands loop set home', 'treadmill home use foldable', 'sports bra women high impact', 'skipping rope bearing weighted', 'table tennis racket butterfly', 'boxing gloves punching bag', 'knee cap support brace pain'] },

  // ══ GROCERY & GOURMET FOODS — Snacks, Cooking, Dry Fruits, Spices, Health Foods, Dairy, Tea/Coffee ══
  { cat: 'grocery', keywords: ['dry fruits combo premium pack', 'green tea organic bags cup', 'honey pure natural organic raw', 'dark chocolate 70 percent cocoa', 'masala spice box stainless steel', 'oats breakfast quaker saffola', 'peanut butter high protein crunchy', 'basmati rice long grain premium', 'olive oil extra virgin cold pressed', 'protein bar healthy snack sugar free', 'coffee beans powder instant premium', 'ghee pure cow desi organic', 'almond cashew pistachios combo', 'jaggery powder organic natural', 'herbal tea immunity booster green', 'biscuits cookies premium gift box'] },

  // ══ CAR & MOTORBIKE — Car Accessories, Motorbike Accessories, Car Electronics, Helmets, Car Care, Tools ══
  { cat: 'auto', keywords: ['car phone holder magnetic dashboard', 'bike helmet full face isi approved', 'car seat cover leather waterproof', 'dash cam dual camera front rear', 'car vacuum cleaner portable 12v', 'bike mobile holder waterproof mount', 'car air freshener perfume dashboard', 'tyre inflator air compressor portable', 'car charger fast type c dual', 'motorbike riding gloves leather', 'car cleaning kit wash wax polish', 'gps tracker vehicle real time', 'car led headlight bulb bright', 'bike chain lock anti theft'] },

  // ══ OFFICE PRODUCTS — Pens, Notebooks, Desk Accessories, Printers, School, Art & Craft ══
  { cat: 'office', keywords: ['pen parker premium gift set', 'notebook diary leather cover premium', 'desk organizer wooden office set', 'printer ink cartridge canon hp epson', 'school bag kids backpack waterproof', 'art supplies drawing kit set', 'calculator scientific casio fx', 'whiteboard marker board office', 'file folder organizer expanding', 'stapler heavy duty office desk', 'pencil box geometry set school', 'watercolor paint set artist brush', 'sticky notes post it set color', 'paper shredder office home cross'] },
];

// ═══════════════════════════════════════════════════
// ─── SCRAPER ENGINE (Scrape.do) ───
// ═══════════════════════════════════════════════════

function scrapeAmazonSearch(keyword) {
  return new Promise((resolve) => {
    // Amazon India search — sorted by popularity, no price filter (all price ranges)
    const amazonURL = `https://www.amazon.in/s?k=${encodeURIComponent(keyword)}&s=popularity-rank&i=aps`;
    const scrapeURL = `https://api.scrape.do/?url=${encodeURIComponent(amazonURL)}&token=${SCRAPER_TOKEN}`;

    https.get(scrapeURL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.log(`  ⚠️  Scraper error for "${keyword}": HTTP ${res.statusCode}`);
            resolve([]);
            return;
          }
          // Scrape.do returns raw HTML directly (not wrapped in JSON)
          const products = parseSearchResults(data);
          resolve(products);
        } catch (e) {
          console.log(`  ⚠️  Parse error for "${keyword}":`, e.message);
          resolve([]);
        }
      });
    }).on('error', (e) => {
      console.log(`  ⚠️  Connection error for "${keyword}":`, e.message);
      resolve([]);
    });
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
// ─── CATEGORY CORRECTION (Amazon-style reassignment) ───
// Sometimes search results return products that belong in a different category.
// This function fixes that BEFORE subcategory detection.
// ═══════════════════════════════════════════════════
function correctCategory(name, originalCat) {
  const text = name.toLowerCase();

  // ── Car & Motorbike products found in other categories ──
  if (originalCat !== 'auto') {
    if (/\bcar\b.*\b(holder|mount|stand|charger|freshener|cover|seat|vacuum|dash.?cam|gps|led|headlight)/.test(text)) return 'auto';
    if (/\bbike\b.*\b(holder|mount|helmet|glove|lock|chain|cover)/.test(text)) return 'auto';
    if (/\bmotorcycle|motorbike|scooter/.test(text) && !/\btoy|model|miniature/.test(text)) return 'auto';
  }

  // ── Baby products found in other categories ──
  if (originalCat !== 'baby') {
    if (/\bbaby\b.*\b(diaper|stroller|pram|carrier|bib|onesie|romper|cradle|walker|sippy|pacifier)/.test(text)) return 'baby';
    if (/\bnewborn|infant\b.*\b(cloth|dress|shoe|sock|blanket|swaddle)/.test(text)) return 'baby';
  }

  // ── Pet products found in other categories ──
  if (originalCat !== 'pets') {
    if (/\b(dog|cat|puppy|kitten)\b.*\b(food|treat|collar|leash|toy|bed|bowl|shampoo|litter)/.test(text)) return 'pets';
    if (/\baquarium|fish.?tank|bird.?cage/.test(text)) return 'pets';
  }

  // ── Sports products found in other categories ──
  if (originalCat !== 'sports') {
    if (/\bcricket\b.*\b(bat|ball|pad|glove|helmet|stump)/.test(text)) return 'sports';
    if (/\bbadminton\b.*\b(racket|shuttlecock)/.test(text)) return 'sports';
    if (/\bdumbbell|barbell|kettlebell|treadmill\b/.test(text)) return 'sports';
  }

  // ── Grocery products found in other categories ──
  if (originalCat !== 'grocery') {
    if (/\b(basmati|rice|dal|atta|flour|ghee|masala|spice)\b.*\b(pack|kg|gram|organic|pure)/.test(text)) return 'grocery';
  }

  return originalCat; // no correction needed
}

// ═══════════════════════════════════════════════════
// ─── SUBCATEGORY DETECTION (mirrors app.js SUBCATEGORIES) ───
// ═══════════════════════════════════════════════════
function detectSubcategory(name, cat) {
  const text = name.toLowerCase();

  // ── FASHION ──
  if (cat === 'fashion') {
    let gender = '';
    if (/\bkids|children|infant|school/.test(text)) gender = 'Kids';
    else if (text.includes('unisex')) gender = 'Unisex';
    else if (/\bwomen|ladies|\bgirl\b|female/.test(text)) gender = "Women's";
    else if (/\bmen('s|\s|$)|\bboy\b/.test(text) || text.includes('male')) gender = "Men's";

    if (/\bpencil.?case|stationery|pen.?stand|eraser|ruler\b/.test(text)) return 'Watches & Accessories';

    let type = '';
    if (/\b(shoe|sneaker|sandal|slipper|boot|heel|loafer|floater|flip.?flop|croc|moccasin)\b/.test(text)) type = 'Footwear';
    else if (/\b(kurta|saree|lehenga|ethnic|sherwani|salwar|dupatta|anarkali|dhoti|lungi|churidar)\b/.test(text)) type = 'Ethnic Wear';
    else if (/\b(jeans|denim|shirt|t-?shirt|tshirt|jacket|dress|top|shorts|hoodie|blazer|trouser|pant|skirt|sweater|cardigan|coat|pullover|polo)\b/.test(text)) type = 'Clothing';
    else if (/\b(sport|gym|track|yoga|running|athletic|workout|fitness|jogger)\b/.test(text)) return 'Sportswear';
    else if (/\b(watch|belt|cap|hat|scarf|stole|ring|bracelet|earring|necklace|sunglass|wallet|case)\b/.test(text)) return 'Watches & Accessories';
    else if (/\b(bag|wallet|backpack|purse|clutch|handbag|tote|sling)\b/.test(text)) return 'Handbags & Clutches';

    if (gender === 'Kids') return "Kids' Fashion";
    if (gender && type) return gender + ' ' + type;
    if (type) return (gender || "Men's") + ' ' + type;
    if (gender) return gender + ' Clothing';
    return "Men's Clothing"; // fallback
  }

  // ── BEAUTY ──
  if (cat === 'beauty') {
    if (/\bmen('s|\s|$)|\bmale|\bbeard/.test(text)) return "Men's Grooming";
    if (/\bserum|moisturiz|sunscreen|face wash|face cream|lotion|cleanser|toner|spf|uv\b/.test(text)) return 'Skin Care';
    if (/\bshampoo|conditioner|hair oil|hair mask|anti.?frizz|hair growth|hair fall|scalp/.test(text)) return 'Hair Care';
    if (/\bperfume|fragrance|deodorant|body mist|cologne|attar|eau de/.test(text)) return 'Fragrance';
    if (/\blipstick|foundation|mascara|kajal|eyeliner|concealer|makeup|blush|primer|compact|eye.?shadow/.test(text)) return 'Make-up';
    if (/\bnail|manicure|pedicure/.test(text)) return 'Nails';
    if (/\bbrush|sponge|tool|applicator|curler|straighten|dryer|iron/.test(text)) return 'Beauty Tools';
    if (/\bbody.?wash|shower|bath|soap|body.?lotion|body.?cream|scrub/.test(text)) return 'Bath & Body';
    return 'Skin Care'; // fallback
  }

  // ── HOME & KITCHEN ──
  if (cat === 'home') {
    if (/\bpan|kadai|tawa|cookware|cooker|pot|wok|skillet|saucepan|frying/.test(text)) return 'Kitchen & Dining';
    if (/\bmixer|grinder|blender|toaster|kettle|oven|microwave|induction|juicer|chopper|food processor|rice cooker|air fryer/.test(text)) return 'Kitchen Appliances';
    if (/\bdecor|wall.?art|painting|showpiece|vase|clock|frame|idol|statue|candle|artificial.?flower/.test(text)) return 'Home Decor';
    if (/\bbedsheet|pillow|curtain|blanket|comforter|mattress|duvet|towel|linen|quilt/.test(text)) return 'Bedding & Linen';
    if (/\bvacuum|mop|broom|cleaning|wiper|duster|scrub|detergent/.test(text)) return 'Cleaning Supplies';
    if (/\blamp|light|led|bulb|chandelier|fairy.?light|torch|lantern|strip.?light/.test(text)) return 'Lighting';
    if (/\btable|chair|shelf|desk|sofa|cabinet|rack|stand|stool|bookcase|wardrobe/.test(text)) return 'Furniture';
    if (/\bstorage|organiz|box|basket|container|bin|drawer|hook|hanger/.test(text)) return 'Storage & Organisation';
    if (/\bgarden|plant|planter|lawn|outdoor|sprinkler|hose|pot|seed|compost/.test(text)) return 'Garden & Outdoors';
    if (/\bmug|cup|bottle|flask|tumbler|plate|bowl|spoon|fork|knife|tray|cutting.?board|lunch.?box/.test(text)) return 'Kitchen & Dining';
    return 'Home Decor'; // fallback
  }

  // ── ELECTRONICS ──
  if (cat === 'electronics') {
    // FIRST: Filter out non-electronic accessories (bags, cases, sleeves, covers, pouch, stand, holder)
    const isAccessory = /\b(bag|sleeve|case|cover|pouch|skin|folio|protector)\b/.test(text);
    // Car/bike holders should NOT be in electronics
    if (/\bcar\b.*\b(holder|mount|stand)|\b(holder|mount|stand).*\bcar\b/.test(text)) return 'Mobiles & Accessories';
    if (/\bbike\b.*\b(holder|mount)|\b(holder|mount).*\bbike\b/.test(text)) return 'Mobiles & Accessories';

    if (/\bsmartwatch|smart.?watch|fitness.?band|fitness.?track/.test(text)) return 'Smart Watches';
    if (/\bpower.?bank|portable.?charger/.test(text)) return 'Power Banks';
    if (/\blaptop|computer|desktop|monitor|keyboard|mouse|touchpad|notebook|chromebook|macbook/.test(text)) {
      return isAccessory ? 'Mobiles & Accessories' : 'Laptops & Computers';
    }
    if (/\btablet|ipad|kindle|e-?reader/.test(text)) {
      return isAccessory ? 'Mobiles & Accessories' : 'Tablets';
    }
    if (/\bphone|mobile|smartphone|iphone|samsung|redmi|realme|oneplus|poco|vivo|oppo/.test(text)) return 'Mobiles & Accessories';
    if (/\bcamera|gopro|dslr|tripod|ring.?light|gimbal|drone/.test(text)) return 'Cameras';
    if (/\bwebcam/.test(text)) return 'Cameras';
    if (/\balexa|echo|smart.?plug|smart.?bulb|smart.?home|google.?home|smart.?switch|wifi.?cam|security.?cam/.test(text)) return 'Smart Home';
    if (/\brouter|wifi|modem|extender|mesh/.test(text)) return 'Smart Home';
    if (/\bspeaker|soundbar|subwoofer|boombox/.test(text)) return 'Speakers';
    if (/\bearbuds|\bearphones|\bheadphones|\btws|\bneckband|\bairpod|\bbuds\b|noise.?cancell/.test(text)) return 'Headphones & Earphones';
    if (/\bcharger|cable|adapter|usb|type.?c|lightning|dock|hub/.test(text)) return 'Chargers & Cables';
    return 'Mobiles & Accessories'; // fallback
  }

  // ── BOOKS ──
  if (cat === 'books') {
    if (/\baction.?figure|figurine|doll|toy.?car|robot|superhero|marvel|dc.?comics|star.?wars|transformer|lego|nerf|hot.?wheel/.test(text)) return 'Action Figures & Toys';
    if (/\bfunko|pop!|vinyl.?figure|collectible.?figure|bobble.?head|schleich|bendable.?figure/.test(text)) return 'Action Figures & Toys';
    if (/\bboard.?game|monopoly|chess|card.?game|scrabble|uno|ludo|carrom|catan|family.?game/.test(text)) return 'Board Games';
    if (/\bpuzzle|jigsaw|rubik|brain.?teas|cribbage/.test(text)) return 'Puzzles';
    if (/\btoy|building.?block|play.?set|remote.?control|rc\s|soft.?toy|teddy|stuffed|plush|play.?doh|craft|slime|nerf/.test(text)) return 'Action Figures & Toys';
    if (/\bfiction|novel|story|thriller|mystery|romance|adventure|fantasy|horror/.test(text)) return 'Fiction';
    if (/\bself.?help|motivat|habit|mindset|atomic|success|leadership|productiv|goal/.test(text)) return 'Self-Help';
    if (/\bbiograph|histor|non.?fiction|memoir|autobiograph|politic|science|philosophy/.test(text)) return 'Non-Fiction';
    if (/\bkid|children|coloring|colour|nursery|bedtime|fairy|rhyme|baby.?book|picture.?book/.test(text)) return "Children's Books";
    if (/\beducat|textbook|exam|ncert|upsc|ssc|study|guide|grammar|math|class\s?\d/.test(text)) return 'Academic & Professional';
    if (/\bcookbook|recipe/.test(text)) return 'Non-Fiction';
    if (/\bplanner|journal|diary|notebook/.test(text)) return 'Self-Help';
    if (/\bfigure|character|creature|bull|moose/.test(text)) return 'Action Figures & Toys';
    return 'Non-Fiction'; // fallback
  }

  // ── HEALTH & PERSONAL CARE ──
  if (cat === 'personal') {
    if (/\btrimmer|razor|shaving|beard|after.?shave|grooming.?kit/.test(text)) return "Men's Grooming";
    if (/\bshampoo|conditioner|hair.?oil|hair.?mask|anti.?dandruff|hair.?fall|scalp/.test(text)) return 'Hair Care';
    if (/\btoothpaste|toothbrush|oral|mouthwash|floss|dental|tongue.?clean/.test(text)) return 'Oral Care';
    if (/\bbody.?wash|shower.?gel|soap|lotion|body.?cream|moisturiz|scrub|body.?oil/.test(text)) return 'Body Care';
    if (/\bpad|tampon|hygiene|intimate.?wash|menstrual|feminine/.test(text)) return "Women's Hygiene";
    if (/\bvitamin|supplement|omega|calcium|iron|biotin|collagen|probiotic|immunity|ayurved|multivitamin/.test(text)) return 'Vitamins & Supplements';
    if (/\bprotein|health|wellness|weight.?loss|weight.?gain|whey|bcaa|creatine|nutrition/.test(text)) return 'Health & Nutrition';
    if (/\byoga|gym|fitness|exercise|workout|mat|skipping|dumbbell|resistance|massage/.test(text)) return 'Health & Nutrition';
    if (/\bface.?razor|epilator|wax/.test(text)) return "Women's Hygiene";
    return 'Body Care'; // fallback
  }

  // ── BABY ──
  if (cat === 'baby') {
    if (/\bdiaper|wipe|nappy|pull.?up/.test(text)) return 'Diapering';
    if (/\btoy|rattle|teether|play|musical|learning/.test(text)) return 'Baby Toys';
    if (/\bbottle|feed|sippy|cup|nipple|formula|cereal|food|bib|nursing/.test(text)) return 'Feeding & Nursing';
    if (/\bbath|soap|lotion|oil|cream|powder|skin|body.?wash|shampoo/.test(text)) return 'Baby Care';
    if (/\bstroller|pram|carrier|car.?seat|walker|bouncer|swing|crib|cradle|gate|monitor/.test(text)) return 'Strollers & Prams';
    if (/\bsafety|swaddle|blanket|mosquito|mat|guard|lock|cover/.test(text)) return 'Baby Safety';
    if (/\bcloth|romper|onesie|set|bodysuit|outfit|dress|boy|girl/.test(text)) return 'Baby Clothing';
    return 'Baby Care'; // fallback
  }

  // ── PET SUPPLIES ──
  if (cat === 'pets') {
    if (/\bdog/.test(text)) return 'Dogs';
    if (/\bcat|kitten/.test(text)) return 'Cats';
    if (/\bfish|aquarium|tank|filter|pump|gravel|substrate/.test(text)) return 'Fish & Aquatics';
    if (/\bbird|parrot|cage|perch|finch|budgie/.test(text)) return 'Birds';
    if (/\bhamster|rabbit|guinea|ferret|small.?animal/.test(text)) return 'Small Animals';
    if (/\bgroom|brush|shampoo|nail.?clip|comb|dryer/.test(text)) return 'Pet Grooming';
    if (/\bpet/.test(text)) return 'Pet Grooming';
    return 'Dogs'; // fallback
  }

  // ── SPORTS, FITNESS & OUTDOORS ──
  if (cat === 'sports') {
    if (/\bcricket|bat|wicket|stump|pad|guard/.test(text)) return 'Cricket';
    if (/\bfootball|soccer|fifa|goal.?keep/.test(text)) return 'Football';
    if (/\bbadminton|shuttlecock|racket|racquet|tennis/.test(text)) return 'Badminton & Tennis';
    if (/\bdumbbell|barbell|bench.?press|weight|kettlebell|pull.?up|push.?up|gym/.test(text)) return 'Gym & Fitness';
    if (/\byoga|meditation|pilates|stretching|foam.?roller/.test(text)) return 'Yoga';
    if (/\brunning|jogging|walking|marathon|treadmill/.test(text)) return 'Running & Walking';
    if (/\bcycl|bike|bicycle/.test(text)) return 'Cycling';
    if (/\bswim|pool|goggles|swim.?cap/.test(text)) return 'Swimming';
    if (/\bprotein|bcaa|creatine|pre.?workout|supplement|whey|nutrition/.test(text)) return 'Sports Nutrition';
    if (/\btable.?tennis|ping.?pong/.test(text)) return 'Badminton & Tennis';
    if (/\bbox|punch|glove|martial/.test(text)) return 'Gym & Fitness';
    if (/\bskip|rope|band|resistance|exercise|helmet/.test(text)) return 'Gym & Fitness';
    if (/\bsport|athletic|fitness/.test(text)) return 'Gym & Fitness';
    return 'Gym & Fitness'; // fallback
  }

  // ── GROCERY & GOURMET FOODS ──
  if (cat === 'grocery') {
    if (/\bsnack|biscuit|chip|namkeen|cookie|cracker|munch/.test(text)) return 'Snacks & Beverages';
    if (/\btea|coffee|juice|drink|water|beverage|soda|shake/.test(text)) return 'Tea, Coffee & Drinks';
    if (/\boil|ghee|atta|flour|rice|dal|salt|sugar|vinegar/.test(text)) return 'Cooking Essentials';
    if (/\bdry.?fruit|almond|cashew|walnut|pistachio|raisin|nut|seed|trail.?mix/.test(text)) return 'Dry Fruits & Nuts';
    if (/\boat|muesli|granola|protein|health|diet|low.?cal|sugar.?free|organic|natural|herbal|ayurved/.test(text)) return 'Health & Organic Foods';
    if (/\bspice|masala|turmeric|cumin|pepper|chilli|cinnamon|cardamom/.test(text)) return 'Spices & Masala';
    if (/\bchocolate|candy|sweet|mithai|laddu|barfi|dairy|milk|cheese|butter|paneer/.test(text)) return 'Dairy & Chocolates';
    if (/\bhoney|jaggery|jam|spread|peanut.?butter/.test(text)) return 'Health & Organic Foods';
    return 'Cooking Essentials'; // fallback
  }

  // ── CAR & MOTORBIKE ──
  if (cat === 'auto') {
    if (/\bcar\b.*\b(accessor|cover|seat|cushion|mat|mirror|visor|sunshade|organiz)/.test(text)) return 'Car Accessories';
    if (/\bbike\b.*\b(accessor|glove|tank|cover|lock|chain|handlebar)/.test(text)) return 'Motorbike Accessories';
    if (/\bdash.?cam|gps|charger|bluetooth|music|stereo|speaker|led|light|camera/.test(text)) return 'Car Electronics';
    if (/\bhelmet|guard|jacket|vest|reflective|safety|knee|glove/.test(text)) return 'Helmets & Gloves';
    if (/\bwash|clean|polish|wax|shampoo|duster|vacuum|microfiber|sponge/.test(text)) return 'Car Care';
    if (/\btool|jack|wrench|inflat|compressor|pump|repair|kit|part/.test(text)) return 'Tools & Auto Parts';
    if (/\bcar\b/.test(text)) return 'Car Accessories';
    if (/\bbike|motorcycle|scooter/.test(text)) return 'Motorbike Accessories';
    if (/\bphone.*holder|mobile.*holder|mount/.test(text)) return 'Car Electronics';
    return 'Car Accessories'; // fallback
  }

  // ── OFFICE PRODUCTS ──
  if (cat === 'office') {
    if (/\bpen\b|ballpoint|fountain|gel.?pen|roller.?ball|ink.?pen|marker|highlighter/.test(text)) return 'Pens & Writing';
    if (/\bnotebook|diary|journal|planner|register|ruled|unruled|notepad/.test(text)) return 'Notebooks & Notepads';
    if (/\bdesk|organiz|tray|holder|stand|paper.?weight|table|file|folder/.test(text)) return 'Desk Accessories';
    if (/\bprinter|cartridge|ink|toner|scanner|paper|a4/.test(text)) return 'Printers & Ink';
    if (/\bschool|bag|backpack|lunch|water.?bottle|compass|geometry|pencil.?box|eraser|ruler|sharpener/.test(text)) return 'School Supplies';
    if (/\bart|paint|brush|canvas|sketch|drawing|crayon|colour|color|pastel|easel|craft/.test(text)) return 'Art & Craft Supplies';
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
  console.log('   🔧 Engine: Scrape.do');
  console.log(`   🏷️  Partner Tag: ${PARTNER_TAG}`);
  console.log(`   🔑 Scraper Token: ${SCRAPER_TOKEN.substring(0, 8)}...`);

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
        // Step 1: Correct category if product belongs elsewhere (e.g., car holder found in electronics)
        const correctedCat = correctCategory(raw.title, catConfig.cat);
        // Step 2: Detect subcategory based on corrected category
        const product = {
          name: raw.title,
          cat: correctedCat,
          subcat: detectSubcategory(raw.title, correctedCat),
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
    const scrapeURL = `https://api.scrape.do/?url=${encodeURIComponent(amazonURL)}&token=${SCRAPER_TOKEN}`;

    https.get(scrapeURL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }

          // Scrape.do returns raw HTML directly
          const html = data;

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
    }).on('error', () => resolve(null));
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
