/* ═══════════════════════════════════
   FIREBASE INITIALIZATION
═══════════════════════════════════ */
firebase.initializeApp({
  apiKey: "AIzaSyCfGlyRMJSD4mFweG6e-gaxN8YRfNIV09Q",
  authDomain: "dealkart-india.firebaseapp.com",
  projectId: "dealkart-india",
  storageBucket: "dealkart-india.firebasestorage.app",
  messagingSenderId: "743640424828",
  appId: "1:743640424828:web:3430f43e721787c43984f9"
});

// Read image URLs from textarea (one per line)
function getImageUrls() {
  const el = document.getElementById('pImages');
  if (!el) return [];
  return el.value.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
}
// Write image URLs to textarea
function setImageUrls(urls) {
  const el = document.getElementById('pImages');
  if (el) el.value = urls.filter(Boolean).join('\n');
}
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence().catch(() => {});

/* ═══════════════════════════════════
   CONSTANTS & STATE
═══════════════════════════════════ */
const NICHES = {
  beauty:      { emoji:'💄', label:'Beauty',                      color:'#9d174d', bg:'#fce7f3' },
  fashion:     { emoji:'👗', label:'Fashion',                     color:'#1e40af', bg:'#dbeafe' },
  home:        { emoji:'🏠', label:'Home & Kitchen',              color:'#065f46', bg:'#d1fae5' },
  electronics: { emoji:'📱', label:'Electronics',                  color:'#92400e', bg:'#fef3c7' },
  books:       { emoji:'📚', label:'Books',                        color:'#4c1d95', bg:'#ede9fe' },
  personal:    { emoji:'💊', label:'Health & Personal Care',       color:'#164e63', bg:'#cffafe' },
  baby:        { emoji:'👶', label:'Baby',                         color:'#9a3412', bg:'#ffedd5' },
  pets:        { emoji:'🐶', label:'Pet Supplies',                 color:'#134e4a', bg:'#ccfbf1' },
  sports:      { emoji:'🏏', label:'Sports, Fitness & Outdoors',   color:'#b91c1c', bg:'#fee2e2' },
  grocery:     { emoji:'🛒', label:'Grocery & Gourmet Foods',      color:'#a16207', bg:'#fef9c3' },
  auto:        { emoji:'🚗', label:'Car & Motorbike',              color:'#475569', bg:'#e2e8f0' },
  office:      { emoji:'🖊️', label:'Office Products',              color:'#6d28d9', bg:'#f5f3ff' }
};

const SUBCATEGORIES = {
  beauty:      ['Skin Care', 'Hair Care', 'Make-up', 'Fragrance', 'Nails', 'Beauty Tools', 'Bath & Body', 'Men\'s Grooming'],
  fashion:     ['Men\'s Clothing', 'Women\'s Clothing', 'Men\'s Footwear', 'Women\'s Footwear', 'Men\'s Ethnic Wear', 'Women\'s Ethnic Wear', 'Kids\' Fashion', 'Watches & Accessories', 'Handbags & Clutches', 'Sportswear'],
  home:        ['Kitchen & Dining', 'Home Decor', 'Furniture', 'Garden & Outdoors', 'Bedding & Linen', 'Storage & Organisation', 'Cleaning Supplies', 'Lighting', 'Kitchen Appliances'],
  electronics: ['Mobiles & Accessories', 'Laptops & Computers', 'Headphones & Earphones', 'Speakers', 'Smart Watches', 'Cameras', 'Chargers & Cables', 'Power Banks', 'Smart Home', 'Tablets'],
  books:       ['Fiction', 'Non-Fiction', 'Self-Help', 'Academic & Professional', 'Children\'s Books', 'Action Figures & Toys', 'Board Games', 'Puzzles'],
  personal:    ['Men\'s Grooming', 'Women\'s Hygiene', 'Oral Care', 'Hair Care', 'Body Care', 'Health & Nutrition', 'Vitamins & Supplements'],
  baby:        ['Baby Clothing', 'Feeding & Nursing', 'Diapering', 'Baby Toys', 'Baby Care', 'Strollers & Prams', 'Baby Safety'],
  pets:        ['Dogs', 'Cats', 'Fish & Aquatics', 'Birds', 'Small Animals', 'Pet Grooming'],
  sports:      ['Cricket', 'Football', 'Badminton & Tennis', 'Gym & Fitness', 'Yoga', 'Running & Walking', 'Cycling', 'Swimming', 'Sports Nutrition'],
  grocery:     ['Snacks & Beverages', 'Cooking Essentials', 'Dry Fruits & Nuts', 'Spices & Masala', 'Health & Organic Foods', 'Dairy & Chocolates', 'Tea, Coffee & Drinks'],
  auto:        ['Car Accessories', 'Motorbike Accessories', 'Car Electronics', 'Helmets & Gloves', 'Car Care', 'Tools & Auto Parts'],
  office:      ['Pens & Writing', 'Notebooks & Notepads', 'Desk Accessories', 'Printers & Ink', 'School Supplies', 'Art & Craft Supplies']
};

let productsCache = [];
let currentFilter = 'all';
let currentSubFilter = 'all';
let adminLoggedIn = false;

/* XSS Sanitize */
function sanitize(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* Price sanity check — fix products stored with wrong MRP */
function sanitizePrice(price, was) {
  let p = Number(price) || 0;
  let w = Number(was) || 0;

  // If MRP stored in paisa (e.g. 28500 for ₹285) or absurdly high, normalize
  if (p > 0 && w > p * 5 && (w / 100) >= p) {
    w = Math.round(w / 100);
  }

  // Cap absurd MRPs that still slip through
  if (p > 0 && w > p * 20) {
    w = Math.round(p * 2);
  }

  // BUG FIX: Only estimate MRP if was was actually provided (non-zero).
  // Do NOT fabricate a fake MRP when was=0 — that creates misleading discounts.
  // If was is still 0 at this point, leave it as 0 (no discount shown).
  if (w > 0 && w <= p && p > 0) {
    w = Math.round(p * 1.3);
  }
  return { price: p, was: w };
}

/* ═══════════════════════════════════
   FIRESTORE DATA LAYER
═══════════════════════════════════ */
function getProducts() { return productsCache; }

function initProductsListener() {
  db.collection('products').onSnapshot(snap => {
    productsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, err => {
    console.error('Firestore:', err);
  });
}

function renderAll() {
  renderHeroPills();
  renderTop4();
  filterDeals(currentFilter, null);
  renderNicheGrid();
}

async function seedIfEmpty() {
  try {
    const snap = await db.collection('products').limit(1).get();
    if (snap.empty) {
      const batch = db.batch();
      getSamples().forEach(p => {
        batch.set(db.collection('products').doc(), p);
      });
      await batch.commit();
    }
  } catch (e) { console.error('Seed:', e); }
}

function getSamples() {
  return [
    { name:'Lakme 9 to 5 Weightless Mousse Foundation', cat:'beauty', rating:4.4, reviews:18200, price:399, was:699, img:'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80', link:'#', active:true },
    { name:"Puma Men's Classic Essential T-Shirt", cat:'fashion', rating:4.3, reviews:9400, price:599, was:999, img:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', link:'#', active:true },
    { name:'Pigeon Non-Stick Kadai 24cm', cat:'home', rating:4.5, reviews:33400, price:849, was:1299, img:'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=600&q=80', link:'#', active:true },
    { name:'boAt Rockerz 255 Pro+ Wireless Earphones', cat:'electronics', rating:4.1, reviews:62000, price:1299, was:2990, img:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80', link:'#', active:true },
    { name:'Himalaya Baby Massage Oil 500ml', cat:'baby', rating:4.6, reviews:44100, price:249, was:399, img:'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80', link:'#', active:true },
    { name:'Mamaearth Onion Hair Oil with Redensyl', cat:'personal', rating:4.3, reviews:27800, price:349, was:599, img:'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80', link:'#', active:true },
    { name:'Pedigree Adult Dog Food Chicken & Veg 3kg', cat:'pets', rating:4.4, reviews:15600, price:649, was:899, img:'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80', link:'#', active:true },
    { name:'Wings of Fire — A.P.J. Abdul Kalam Paperback', cat:'books', rating:4.7, reviews:91000, price:169, was:299, img:'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80', link:'#', active:true },
    { name:'SUGAR Cosmetics Matte Attack Lipstick', cat:'beauty', rating:4.2, reviews:8300, price:499, was:799, img:'https://images.unsplash.com/photo-1586495777744-4e6232bf2f62?w=600&q=80', link:'#', active:true },
    { name:'Prestige Iris 750W Mixer Grinder 3 Jars', cat:'electronics', rating:4.3, reviews:28900, price:1999, was:3499, img:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', link:'#', active:true },
    { name:'Utkarsh Kids Alphabet Puzzle Set', cat:'books', rating:4.5, reviews:6200, price:299, was:549, img:'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&q=80', link:'#', active:true },
    { name:'W for Woman Straight Ethnic Kurta', cat:'fashion', rating:4.1, reviews:12700, price:699, was:1299, img:'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&q=80', link:'#', active:true }
  ];
}

/* ═══════════════════════════════════
   PAGE NAVIGATION
═══════════════════════════════════ */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  var el = document.getElementById(id);
  if (!el) { id = 'page-landing'; el = document.getElementById(id); }
  el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Push state so browser back button works (but replace for landing to keep it as base)
  if (id === 'page-landing') {
    history.replaceState(id, '', '');
  } else if (history.state !== id) {
    history.pushState(id, '', '');
  }
}
// Set initial state
history.replaceState('page-landing', '', '');
window.addEventListener('popstate', function(e) {
  var pageId = e.state || 'page-landing';
  var el = document.getElementById(pageId);
  if (!el) pageId = 'page-landing';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
function goLanding() { showPage('page-landing'); }
function goDeals(cat) {
  showPage('page-deals');
  if (cat) {
    filterDeals(cat, null);
    document.querySelectorAll('#page-deals .filter-btn').forEach(b => {
      b.classList.remove('active');
      if (b.textContent.toLowerCase().includes(cat) || (cat === 'all' && b.textContent.includes('All Deals')))
        b.classList.add('active');
    });
  } else {
    filterDeals('all', null);
    document.querySelectorAll('#page-deals .filter-btn').forEach(b => {
      b.classList.remove('active');
      if (b.textContent.includes('All Deals')) b.classList.add('active');
    });
  }
}

/* ═══════════════════════════════════
   PRODUCT DETAIL
═══════════════════════════════════ */
function openProduct(id) {
  const p = getProducts().find(x => x.id === id);
  if (!p) return;
  const n = NICHES[p.cat] || { emoji:'⭐', label:p.cat, color:'#6b7280', bg:'#f3f4f6' };
  // BUG FIX: Use local copies, never mutate productsCache objects
  const sp = sanitizePrice(p.price, p.was);
  const price = sp.price; const was = sp.was;
  const disc = was ? Math.round((1 - price / was) * 100) : 0;
  const saved = was ? was - price : 0;
  const sn = sanitize(p.name);
  // BUG FIX: Fallback to images[0] if img field missing (products from auto-deals.js)
  const allImgs = (p.images && p.images.length) ? p.images : (p.img ? [p.img] : []);
  const sl = sanitize(p.link);

  // Store images globally for slider navigation
  window._galleryImages = allImgs;
  window._galleryIndex = 0;

  document.getElementById('detailNavTitle').textContent = p.name;
  if (!allImgs.length) allImgs.push('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600');
  // BUG FIX: Store link on window to avoid single-quote XSS in onclick attribute interpolation
  window._currentProductLink = p.link;
  document.getElementById('detailBody').innerHTML = `
    <div class="detail-gallery">
      <div class="detail-img-box">
        <div class="gallery-slider">
          <img id="galleryMain" src="${sanitize(allImgs[0])}" alt="${sn}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'">
          <div class="detail-img-badges">
            <span class="detail-badge">${p.rating.toFixed(1)}★</span>
            ${disc > 0 ? `<span class="detail-badge sale">−${disc}% OFF</span>` : ''}
          </div>
          ${allImgs.length > 1 ? `
            <button class="gallery-arrow gallery-prev" onclick="galleryNav(-1)"><i class="fas fa-chevron-left"></i></button>
            <button class="gallery-arrow gallery-next" onclick="galleryNav(1)"><i class="fas fa-chevron-right"></i></button>
            <div class="gallery-counter"><span id="galleryCounter">1</span> / ${allImgs.length}</div>
          ` : ''}
        </div>
      </div>
      ${allImgs.length > 1 ? `<div class="gallery-thumbs">${allImgs.map((im, i) => `<img src="${sanitize(im)}" class="gallery-thumb${i===0?' active':''}" onclick="galleryGoTo(${i})" onerror="this.remove()">`).join('')}</div>` : ''}
    </div>
    <div class="detail-info">
      <div class="detail-niche niche-${sanitize(p.cat)}" style="background:${n.bg};color:${n.color};">${n.emoji} ${n.label}${p.subcat ? ' › ' + sanitize(p.subcat) : ''}</div>
      <h1 class="detail-name">${sn}</h1>
      <div class="detail-rating-row">
        <span class="detail-stars">${'★'.repeat(Math.floor(p.rating))}${p.rating % 1 >= .5 ? '½' : ''}</span>
        <span class="detail-rating-num">${p.rating.toFixed(1)} / 5.0</span>
        ${p.reviews ? `<span class="detail-reviews">${p.reviews.toLocaleString('en-IN')} ratings on Amazon</span>` : ''}
      </div>
      <div class="detail-price-box">
        <div class="detail-price-row">
          <span class="detail-price-now">₹${price.toLocaleString('en-IN')}</span>
          ${was ? `<span class="detail-price-was">₹${was.toLocaleString('en-IN')}</span>` : ''}
          ${disc > 0 ? `<span class="detail-price-off">${disc}% off</span>` : ''}
        </div>
        ${saved > 0 ? `<div class="detail-savings"><i class="fas fa-tag" style="margin-right:4px;"></i>You save ₹${saved.toLocaleString('en-IN')} on this deal!</div>` : ''}
      </div>
      <a href="${sl}" target="_blank" rel="noopener" onclick="return checkCurrentLink()">
        <button class="detail-buy-btn"><i class="fab fa-amazon"></i> Buy on Amazon India</button>
      </a>
      <hr class="detail-divider">
      <div class="detail-meta">
        <div class="detail-meta-row"><span class="detail-meta-label">Category</span><span class="detail-meta-val">${n.emoji} ${n.label}</span></div>
        ${p.subcat ? `<div class="detail-meta-row"><span class="detail-meta-label">Subcategory</span><span class="detail-meta-val">${sanitize(p.subcat)}</span></div>` : ''}
        <div class="detail-meta-row"><span class="detail-meta-label">Star Rating</span><span class="detail-meta-val">${p.rating.toFixed(1)} ★</span></div>
        ${p.reviews ? `<div class="detail-meta-row"><span class="detail-meta-label">Reviews</span><span class="detail-meta-val">${p.reviews.toLocaleString('en-IN')}+</span></div>` : ''}
        ${disc > 0 ? `<div class="detail-meta-row"><span class="detail-meta-label">Discount</span><span class="detail-meta-val" style="color:var(--accent);">${disc}% off MRP</span></div>` : ''}
        <div class="detail-meta-row"><span class="detail-meta-label">Sold on</span><span class="detail-meta-val">Amazon India</span></div>
      </div>
    </div>`;

  const related = getProducts()
    .filter(x => x.active && x.rating >= 4 && x.cat === p.cat && x.id !== id)
    .slice(0, 4);
  document.getElementById('relatedGrid').innerHTML = related.length
    ? related.map(r => miniCard(r)).join('')
    : `<p style="color:var(--ink3);font-size:13px;grid-column:1/-1;">No other deals in this category yet.</p>`;
  showPage('page-detail');
}

function miniCard(p) {
  const n = NICHES[p.cat] || { emoji:'⭐', label:p.cat, color:'#6b7280', bg:'#f3f4f6' };
  // BUG FIX: Use local copies, never mutate productsCache objects
  const sp = sanitizePrice(p.price, p.was);
  const price = sp.price; const was = sp.was;
  const disc = was ? Math.round((1 - price / was) * 100) : 0;
  const sn = sanitize(p.name);
  // BUG FIX: Fallback to images[0] if img field missing
  const imgSrc = sanitize(p.img || (p.images && p.images[0]) || '');
  return `<div class="product-card" onclick="openProduct('${p.id}')">
    <div class="card-img-wrap">
      <img src="${imgSrc}" alt="${sn}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'">
      <span class="card-badge">${p.rating.toFixed(1)}★</span>
      ${disc > 0 ? `<span class="card-badge sale">−${disc}%</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-name">${sn}</div>
      <div class="card-price">
        <span class="price-now">₹${price.toLocaleString('en-IN')}</span>
        ${was ? `<span class="price-was">₹${was.toLocaleString('en-IN')}</span>` : ''}
      </div>
      <button class="card-btn"><i class="fas fa-eye" style="font-size:10px;"></i> View Deal</button>
    </div>
  </div>`;
}

function checkLink(href) {
  if (!href || href === '#') { showToast('No Amazon link set yet.'); return false; }
  return true;
}

// BUG FIX: Safe version that reads link from window variable (avoids XSS via inline string interpolation)
function checkCurrentLink() {
  return checkLink(window._currentProductLink || '');
}

function switchGalleryImg(thumb, src) {
  document.getElementById('galleryMain').src = src;
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

function galleryNav(dir) {
  if (!window._galleryImages || window._galleryImages.length <= 1) return;
  window._galleryIndex = (window._galleryIndex + dir + window._galleryImages.length) % window._galleryImages.length;
  var idx = window._galleryIndex;
  document.getElementById('galleryMain').src = window._galleryImages[idx];
  var counter = document.getElementById('galleryCounter');
  if (counter) counter.textContent = idx + 1;
  document.querySelectorAll('.gallery-thumb').forEach(function(t, i) {
    t.classList.toggle('active', i === idx);
  });
}

function galleryGoTo(idx) {
  if (!window._galleryImages) return;
  window._galleryIndex = idx;
  document.getElementById('galleryMain').src = window._galleryImages[idx];
  var counter = document.getElementById('galleryCounter');
  if (counter) counter.textContent = idx + 1;
  document.querySelectorAll('.gallery-thumb').forEach(function(t, i) {
    t.classList.toggle('active', i === idx);
  });
}

/* ═══════════════════════════════════
   TOP 4 BEST VALUE
═══════════════════════════════════ */
function renderTop4() {
  const prods = getProducts().filter(p => p.active && p.rating >= 4);
  // BUG FIX: Use spread copies instead of mutating productsCache objects
  const scored = prods.map(p => {
    const sp = sanitizePrice(p.price, p.was);
    const price = sp.price; const was = sp.was;
    const disc = was ? (1 - price / was) * 100 : 0;
    return { ...p, price, was, score: (p.rating * 15) + (disc * 0.8) + Math.min((p.reviews||0) / 1000, 20) };
  }).sort((a, b) => b.score - a.score).slice(0, 4);

  document.getElementById('top4Grid').innerHTML = scored.map(p => {
    const n = NICHES[p.cat] || { emoji:'⭐', label:p.cat, color:'#6b7280', bg:'#f3f4f6' };
    const disc = p.was ? Math.round((1 - p.price / p.was) * 100) : 0;
    const sn = sanitize(p.name);
    const imgSrc = sanitize(p.img || (p.images && p.images[0]) || '');
    return `<div class="top4-card" onclick="openProduct('${p.id}')">
      <div class="top4-img">
        <img src="${imgSrc}" alt="${sn}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'">
        <span class="top4-rating-badge">${p.rating.toFixed(1)}★</span>
        ${disc > 0 ? `<span class="top4-off-badge">−${disc}%</span>` : ''}
      </div>
      <div class="top4-body">
        <div class="top4-niche niche-${sanitize(p.cat)}" style="background:${n.bg};color:${n.color};">${n.emoji} ${n.label}</div>
        <div class="top4-name">${sn}</div>
        <div class="top4-price">
          <span class="top4-price-now">₹${p.price.toLocaleString('en-IN')}</span>
          ${p.was ? `<span class="top4-price-was">₹${p.was.toLocaleString('en-IN')}</span>` : ''}
        </div>
        <button class="top4-tap"><i class="fas fa-eye"></i> View Deal</button>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════
   ALL DEALS GRID
═══════════════════════════════════ */
function renderGrid(prods) {
  const active = prods.filter(p => p.active && p.rating >= 4);
  document.getElementById('totalDeals').textContent = getProducts().filter(p => p.active).length;
  document.getElementById('dealCount').textContent = active.length + ' deal' + (active.length !== 1 ? 's' : '') + ' found';

  if (!active.length) {
    document.getElementById('productGrid').innerHTML =
      `<div class="empty-state"><i class="fas fa-star"></i><h3>No deals in this category yet</h3><p>Check back soon!</p></div>`;
    return;
  }
  document.getElementById('productGrid').innerHTML = active.map(p => {
    const n = NICHES[p.cat] || { emoji:'⭐', label:p.cat, color:'#6b7280', bg:'#f3f4f6' };
    // BUG FIX: Use local copies, never mutate productsCache objects
    const sp = sanitizePrice(p.price, p.was);
    const price = sp.price; const was = sp.was;
    const disc = was ? Math.round((1 - price / was) * 100) : 0;
    const sn = sanitize(p.name);
    // BUG FIX: Fallback to images[0] if img field missing (auto-deals.js products)
    const imgSrc = sanitize(p.img || (p.images && p.images[0]) || '');
    // BUG FIX: Use Math.floor for stars so 4.5 shows 4 filled stars (not 5)
    const starCount = Math.min(5, Math.floor(p.rating));
    return `<div class="product-card" onclick="openProduct('${p.id}')">
      <div class="card-img-wrap">
        <img src="${imgSrc}" alt="${sn}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'">
        <span class="card-badge">${p.rating.toFixed(1)}★</span>
        ${disc > 0 ? `<span class="card-badge sale">−${disc}%</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-niche niche-${sanitize(p.cat)}" style="background:${n.bg};color:${n.color};">${n.emoji} ${n.label}</div>
        ${p.subcat ? `<div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">› ${sanitize(p.subcat)}</div>` : ''}
        <div class="card-name">${sn}</div>
        <div class="card-rating">
          <span class="stars">${'★★★★★'.slice(0, starCount)}</span>
          <span class="rating-num">${p.rating.toFixed(1)}</span>
          ${p.reviews ? `<span class="rating-count">(${p.reviews.toLocaleString('en-IN')})</span>` : ''}
        </div>
        <div class="card-price">
          <span class="price-now">₹${price.toLocaleString('en-IN')}</span>
          ${was ? `<span class="price-was">₹${was.toLocaleString('en-IN')}</span>` : ''}
          ${disc > 0 ? `<span class="price-off">${disc}% off</span>` : ''}
        </div>
        <button class="card-btn"><i class="fas fa-eye" style="font-size:11px;"></i> View Deal</button>
      </div>
    </div>`;
  }).join('');
}

function filterDeals(cat, btn) {
  currentFilter = cat;
  currentSubFilter = 'all';
  document.querySelectorAll('#page-deals .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSubcategoryBar(cat);
  applyFilters();
}

function filterBySubcat(subcat, btn) {
  currentSubFilter = subcat;
  document.querySelectorAll('.subcat-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyFilters();
}

function applyFilters() {
  const search = (document.getElementById('searchInput') || {}).value || '';
  const prods = getProducts();
  let filtered = currentFilter === 'all' ? prods : prods.filter(p => p.cat === currentFilter);
  if (currentSubFilter !== 'all') {
    filtered = filtered.filter(function(p) {
      if (p.subcat === currentSubFilter) return true;
      // Unisex products show in both Men's and Women's
      if (currentSubFilter.startsWith("Men's") || currentSubFilter.startsWith("Women's")) {
        var base = currentSubFilter.replace(/^(Men's|Women's) /, 'Unisex ');
        if (p.subcat === base) return true;
      }
      return false;
    });
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
  }
  renderGrid(filtered);
}

function renderSubcategoryBar(cat) {
  var bar = document.getElementById('subcatBar');
  if (!bar) return;
  if (cat === 'all' || !SUBCATEGORIES[cat]) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }
  var subs = SUBCATEGORIES[cat];
  var prods = getProducts().filter(p => p.active && p.cat === cat);
  bar.style.display = 'flex';
  bar.innerHTML = '<button class="subcat-chip active" onclick="filterBySubcat(\'all\',this)">All</button>' +
    subs.map(s => {
      var cnt = prods.filter(p => p.subcat === s).length;
      return '<button class="subcat-chip" onclick="filterBySubcat(\'' + s.replace(/'/g, "\\'") + '\',this)">' + s + (cnt ? ' (' + cnt + ')' : '') + '</button>';
    }).join('');
}

function searchProducts(query) {
  applyFilters();
}

// Update subcategory dropdown in admin form when category changes
function updateSubcatDropdown(cat) {
  var container = document.getElementById('pSubCatWrap');
  if (!container) return;
  var subs = SUBCATEGORIES[cat] || [];
  if (!subs.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  container.innerHTML = '<label class="form-label">Subcategory</label>' +
    '<select class="form-select" id="pSubCat">' +
    '<option value="">— None —</option>' +
    subs.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
    '</select>';
}

/* ═══════════════════════════════════
   NICHE GRID & HERO PILLS
═══════════════════════════════════ */
function renderNicheGrid() {
  const prods = getProducts().filter(p => p.active && p.rating >= 4);
  document.getElementById('nicheGrid').innerHTML =
    Object.entries(NICHES).map(([k, v]) => {
      const cnt = prods.filter(p => p.cat === k).length;
      return `<div class="niche-card" onclick="goDeals('${k}')">
        <div class="niche-icon">${v.emoji}</div>
        <div class="niche-name">${v.label}</div>
        <div class="niche-count">${cnt} deal${cnt !== 1 ? 's' : ''}</div>
      </div>`;
    }).join('');
}

function renderHeroPills() {
  document.getElementById('heroPills').innerHTML =
    Object.entries(NICHES).map(([k, v]) =>
      `<button class="hero-pill" onclick="goDeals('${k}')">${v.emoji} ${v.label}</button>`
    ).join('');
}

function renderNicheCheckboxes() {
  document.getElementById('nicheCheckboxes').innerHTML =
    Object.entries(NICHES).map(([k, v]) =>
      `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input type="checkbox" value="${k}"> ${v.emoji} ${v.label}</label>`
    ).join('');
}

/* ═══════════════════════════════════
   FIREBASE AUTH (SECURE ADMIN)
═══════════════════════════════════ */
auth.onAuthStateChanged(user => {
  adminLoggedIn = !!user;
  const btns = [document.getElementById('navAdminBtn'), document.getElementById('navAdminBtn2')];
  btns.forEach(b => {
    if (!b) return;
    b.innerHTML = user
      ? '<i class="fas fa-shield-alt" style="margin-right:4px;color:var(--accent);font-size:10px;"></i>Admin'
      : 'Admin';
  });
  // Run data cleanup migrations when admin logs in
  if (user) {
    setTimeout(runAdminMigrations, 1000);
  }
});

function openAdminGate() {
  if (adminLoggedIn) { document.getElementById('adminModal').classList.add('show'); return; }
  document.getElementById('adminEmailInput').value = '';
  document.getElementById('adminPwdInput').value = '';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('adminLoginModal').classList.add('show');
  setTimeout(() => document.getElementById('adminEmailInput').focus(), 100);
}

async function checkAdminLogin() {
  const email = document.getElementById('adminEmailInput').value.trim();
  const pwd = document.getElementById('adminPwdInput').value;
  if (!email || !pwd) { showToast('Enter email and password.'); return; }

  const btn = document.querySelector('#adminLoginModal .submit-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    await auth.signInWithEmailAndPassword(email, pwd);
    closeModal('adminLoginModal');
    document.getElementById('adminModal').classList.add('show');
    showToast('Welcome back, Admin!');
    seedIfEmpty();
    
    // Auto-fill from bookmarklet after login
    if (window._quickAddData) {
      const data = window._quickAddData;
      window._quickAddData = null;
      setTimeout(() => {
        document.getElementById('pName').value = data.name || '';
        document.getElementById('pPrice').value = data.price || '';
        document.getElementById('pWas').value = data.was || '';
        document.getElementById('pRating').value = data.rating || '4.5';
        document.getElementById('pReviews').value = data.reviews || '';
        document.getElementById('pLink').value = data.link || '';
        document.getElementById('pCat').value = data.cat || 'home';
        document.getElementById('pActive').checked = true;
        const imgs = data.images || (data.img ? [data.img] : []);
        const pImagesEl = document.getElementById('pImages');
        if (pImagesEl) pImagesEl.value = imgs.join('\n');
        showToast('✅ ' + imgs.length + ' images loaded! Click Add Product.');
      }, 300);
    }
  } catch (e) {
    const el = document.getElementById('loginError');
    el.style.display = 'block';
    if (e.code === 'auth/user-not-found') el.innerHTML = '<i class="fas fa-exclamation-circle"></i> No account found with this email.';
    else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') el.innerHTML = '<i class="fas fa-exclamation-circle"></i> Incorrect password.';
    else el.innerHTML = '<i class="fas fa-exclamation-circle"></i> Login failed. Check credentials.';
    document.getElementById('adminPwdInput').value = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-unlock" style="margin-right:5px;"></i>Login';
  }
}

async function adminLogout() {
  await auth.signOut();
  closeModal('adminModal');
  showToast('Logged out.');
}

function togglePwdVisibility() {
  const inp = document.getElementById('adminPwdInput');
  const icon = document.getElementById('eyeBtn').querySelector('i');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

/* ═══════════════════════════════════
   ADMIN CRUD (FIRESTORE)
═══════════════════════════════════ */
function adminTab(tab, btn) {
  document.querySelectorAll('#adminModal .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('adminAdd').style.display = tab === 'add' ? '' : 'none';
  document.getElementById('adminManage').style.display = tab === 'manage' ? '' : 'none';
  if (tab === 'manage') renderManageList();
}

async function addProduct() {
  if (!adminLoggedIn) { showToast('Please login first.'); return; }
  const name = document.getElementById('pName').value.trim();
  const cat = document.getElementById('pCat').value;
  const subcat = (document.getElementById('pSubCat') || {}).value || '';
  const rating = parseFloat(document.getElementById('pRating').value) || 4.5;
  const price = parseInt(document.getElementById('pPrice').value) || 0;
  const was = parseInt(document.getElementById('pWas').value) || 0;
  const link = document.getElementById('pLink').value.trim();
  const reviews = parseInt(document.getElementById('pReviews').value) || 0;
  const active = document.getElementById('pActive').checked;

  if (!name) { showToast('Please enter a product name.'); return; }
  if (rating < 4 || rating > 5) { showToast('Rating must be 4.0–5.0.'); return; }

  try {
    let images = getImageUrls();
    if (!images.length) { showToast('Please add at least one image URL.'); return; }
    const mainImg = images[0];
    
    console.log('Saving product with', images.length, 'images:', images);
    await db.collection('products').add({
      name, cat, subcat, rating, reviews, price, was, img: mainImg, link, active,
      images: images,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    ['pName','pLink','pPrice','pWas','pReviews'].forEach(id => document.getElementById(id).value = '');
    setImageUrls([]);
    showToast('Product added with ' + images.length + ' images!');
    closeModal('adminModal');
  } catch (e) {
    console.error('Add error:', e);
    showToast('Failed: ' + e.message);
  }
}

function renderManageList() {
  const prods = getProducts();
  if (!prods.length) {
    document.getElementById('manageList').innerHTML = '<p style="color:var(--ink3);font-size:13px;">No products yet.</p>';
    return;
  }
  document.getElementById('manageList').innerHTML = prods.map(p => {
    const n = NICHES[p.cat] || { emoji:'⭐', label:p.cat };
    const sp = sanitizePrice(p.price, p.was); p.price = sp.price; p.was = sp.was;
    const disc = p.was ? Math.round((1 - p.price / p.was) * 100) : 0;
    return `<div style="display:flex;gap:14px;padding:14px;margin-bottom:10px;border:1px solid var(--border);border-radius:12px;background:var(--bg);transition:box-shadow .2s;" onmouseover="this.style.boxShadow='0 2px 12px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow='none'">
      <img src="${sanitize(p.img)}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;flex-shrink:0;" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200'">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;line-height:1.3;">${n.emoji} ${sanitize(p.name)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--ink3);margin-bottom:8px;">
          <span style="background:${n.bg || '#f3f4f6'};color:${n.color || '#6b7280'};padding:2px 8px;border-radius:5px;font-weight:600;">${n.label}</span>
          <span>₹${p.price.toLocaleString('en-IN')}${p.was ? ' <s style="color:#999;">₹'+p.was.toLocaleString('en-IN')+'</s>' : ''}</span>
          ${disc > 0 ? '<span style="color:#16a34a;font-weight:600;">'+disc+'% off</span>' : ''}
          <span>${p.rating}★</span>
          ${p.reviews ? '<span>'+p.reviews.toLocaleString('en-IN')+' reviews</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="editProduct('${p.id}')" style="background:var(--accent);color:#fff;border:none;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;"><i class="fas fa-edit" style="margin-right:3px;"></i>Edit</button>
          <button onclick="toggleProduct('${p.id}')" style="background:none;border:1px solid var(--border2);border-radius:7px;padding:5px 14px;font-size:12px;color:var(--ink2);cursor:pointer;"><i class="fas fa-${p.active ? 'eye-slash' : 'eye'}" style="margin-right:3px;"></i>${p.active ? 'Hide' : 'Show'}</button>
          <button onclick="deleteProduct('${p.id}')" style="background:none;border:1px solid #fecaca;border-radius:7px;padding:5px 14px;font-size:12px;color:#dc2626;cursor:pointer;"><i class="fas fa-trash" style="margin-right:3px;"></i>Delete</button>
        </div>
        <div style="margin-top:6px;font-size:11px;">${p.active ? '<span style="color:#16a34a;">✅ Active — visible to visitors</span>' : '<span style="color:#f59e0b;">⏸ Hidden — not shown on site</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

function editProduct(id) {
  const p = getProducts().find(x => x.id === id);
  if (!p) return;

  // Switch to Add tab and fill form
  document.querySelectorAll('#adminModal .filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#adminModal .filter-btn')[0].classList.add('active');
  document.getElementById('adminAdd').style.display = '';
  document.getElementById('adminManage').style.display = 'none';

  document.getElementById('pName').value = p.name || '';
  document.getElementById('pCat').value = p.cat || 'beauty';
  document.getElementById('pRating').value = p.rating || 4.5;
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pWas').value = p.was || '';
  document.getElementById('pLink').value = p.link || '';
  document.getElementById('pReviews').value = p.reviews || '';
  document.getElementById('pActive').checked = p.active !== false;
  setImageUrls(p.images || [p.img]);

  // Change button to "Update" mode
  const btn = document.querySelector('#adminAdd .submit-btn');
  btn.innerHTML = '<i class="fas fa-save" style="margin-right:5px;"></i>Update Product';
  btn.onclick = async function() {
    if (!adminLoggedIn) { showToast('Please login first.'); return; }
    const name = document.getElementById('pName').value.trim();
    if (!name) { showToast('Please enter a product name.'); return; }

    try {
      await db.collection('products').doc(id).update({
        name: name,
        cat: document.getElementById('pCat').value,
        rating: parseFloat(document.getElementById('pRating').value) || 4.5,
        price: parseInt(document.getElementById('pPrice').value) || 0,
        was: parseInt(document.getElementById('pWas').value) || 0,
        img: getImageUrls()[0] || '',
        link: document.getElementById('pLink').value.trim(),
        reviews: parseInt(document.getElementById('pReviews').value) || 0,
        active: document.getElementById('pActive').checked,
        images: getImageUrls()
      });
      showToast('Product updated!');
      // BUG FIX: Restore button icon when reverting from Update to Add mode
      btn.innerHTML = '<i class="fas fa-plus" style="margin-right:5px;"></i>Add Product';
      btn.onclick = addProduct;
      ['pName','pLink','pPrice','pWas','pReviews'].forEach(fid => document.getElementById(fid).value = '');
      setImageUrls([]);
    } catch (e) {
      console.error('Update:', e);
      showToast('Failed to update.');
    }
  };

  showToast('Editing: ' + p.name.substring(0, 30) + '...');
}

async function toggleProduct(id) {
  if (!adminLoggedIn) return;
  const p = getProducts().find(x => x.id === id);
  if (!p) return;
  try {
    await db.collection('products').doc(id).update({ active: !p.active });
    showToast(p.active ? 'Product hidden.' : 'Product visible!');
    setTimeout(renderManageList, 500);
  } catch (e) { showToast('Failed to update.'); }
}

async function deleteProduct(id) {
  if (!adminLoggedIn) return;
  if (!confirm('Delete this product permanently?')) return;
  try {
    await db.collection('products').doc(id).delete();
    showToast('Deleted.');
    setTimeout(renderManageList, 500);
  } catch (e) { showToast('Failed to delete.'); }

}

/* ═══════════════════════════════════
   SUBSCRIPTIONS (FIRESTORE)
═══════════════════════════════════ */
async function subscribeNewsletter() {
  const e = document.getElementById('nlEmail').value.trim();
  if (!e || !e.includes('@')) { showToast('Enter a valid email.'); return; }
  try {
    // BUG FIX: Check for duplicate subscription before adding
    const existing = await db.collection('subscribers')
      .where('email', '==', e).where('type', '==', 'newsletter').limit(1).get();
    if (!existing.empty) {
      document.getElementById('nlEmail').value = '';
      showToast('Already subscribed! We\'ll keep sending deals.');
      return;
    }
    await db.collection('subscribers').add({
      email: e, type: 'newsletter', categories: [],
      subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) { console.error('Sub:', err); }
  document.getElementById('nlEmail').value = '';
  showToast('Subscribed! Best deals incoming.');
}

async function subscribeAlerts() {
  const e = document.getElementById('alertEmail').value.trim();
  if (!e || !e.includes('@')) { showToast('Enter a valid email.'); return; }
  const cats = [...document.querySelectorAll('#nicheCheckboxes input:checked')].map(c => c.value);
  try {
    await db.collection('subscribers').add({
      email: e, type: 'alerts',
      categories: cats.length ? cats : Object.keys(NICHES),
      subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) { console.error('Alert sub:', err); }
  closeModal('notifyModal');
  showToast('Alerts on for ' + (cats.length || 'all') + ' categories!');
}

/* ═══════════════════════════════════
   UTILS
═══════════════════════════════════ */
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

/* ═══════════════════════════════════
   QUICK-ADD FROM AMAZON (BOOKMARKLET)
═══════════════════════════════════ */
function handleQuickAdd() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('quickadd') !== '1') return;

  // Clean URL without reloading
  window.history.replaceState({}, '', window.location.pathname);

  // Collect images from individual params
  const imagesArr = [];
  const mainImg = params.get('img') || '';
  if (mainImg) imagesArr.push(mainImg);
  for (let i = 2; i <= 6; i++) {
    const u = params.get('img' + i);
    if (u && u.startsWith('http')) imagesArr.push(u);
  }

  const data = {
    name: params.get('name') || '',
    price: params.get('price') || '',
    was: params.get('was') || '',
    rating: params.get('rating') || '4.5',
    reviews: params.get('reviews') || '',
    img: mainImg,
    images: imagesArr,
    link: params.get('link') || '',
    cat: detectCategory(params.get('name') || '', params.get('breadcrumb') || ''),
    subcat: detectSubcategory(params.get('name') || '', params.get('breadcrumb') || '', detectCategory(params.get('name') || '', params.get('breadcrumb') || ''))
  };

  console.log('QuickAdd images:', imagesArr.length, imagesArr);

  // Wait for auth state, then fill form
  const fillForm = () => {
    if (adminLoggedIn) {
      document.getElementById('adminModal').classList.add('show');
      setTimeout(() => {
        document.getElementById('pName').value = data.name;
        document.getElementById('pPrice').value = data.price;
        document.getElementById('pWas').value = data.was;
        document.getElementById('pRating').value = data.rating;
        document.getElementById('pReviews').value = data.reviews;
        document.getElementById('pLink').value = data.link;
        document.getElementById('pCat').value = data.cat;
        updateSubcatDropdown(data.cat);
        if (data.subcat) setTimeout(function() { var sel = document.getElementById('pSubCat'); if (sel) sel.value = data.subcat; }, 100);
        document.getElementById('pActive').checked = true;
        setImageUrls(data.images);
        showToast('✅ ' + data.images.length + ' images loaded! Click Add Product.');
      }, 300);
    } else {
      window._quickAddData = data;
      openAdminGate();
      showToast('Login first, then product will auto-fill.');
    }
  };

  setTimeout(fillForm, 1000);
}

// Auto-detect category and subcategory from product name/breadcrumb
function detectCategory(name, breadcrumb) {
  const text = (name + ' ' + breadcrumb).toLowerCase();
  const rules = [
    { cat: 'beauty', words: ['makeup', 'foundation', 'lipstick', 'mascara', 'eyeshadow', 'cosmetic', 'serum', 'moisturizer', 'sunscreen', 'face wash', 'cleanser'] },
    { cat: 'fashion', words: ['shirt', 'tshirt', 't-shirt', 'kurta', 'dress', 'jeans', 'saree', 'shoes', 'sandal', 'watch', 'handbag', 'jacket', 'shorts', 'denim', 'women', 'men', 'legging', 'pant', 'trouser', 'skirt', 'top', 'crop', 'blouse', 'sneaker', 'slipper', 'heel', 'boot', 'cap', 'belt', 'bag', 'clutch', 'scarf', 'stole', 'dupatta', 'ethnic', 'western', 'casual', 'formal', 'fashion', 'clothing', 'apparel', 'wear', 'outfit'] },
    { cat: 'home', words: ['kitchen', 'kadai', 'pan', 'utensil', 'bedsheet', 'pillow', 'curtain', 'decor', 'furniture', 'organizer', 'vacuum'] },
    { cat: 'electronics', words: ['earphone', 'headphone', 'speaker', 'charger', 'cable', 'phone', 'laptop', 'tablet', 'camera', 'power bank', 'mixer', 'grinder', 'iron'] },
    { cat: 'books', words: ['book', 'paperback', 'hardcover', 'novel', 'puzzle', 'toy', 'game', 'lego', 'board game'] },
    { cat: 'personal', words: ['shampoo', 'hair oil', 'body wash', 'soap', 'deodorant', 'perfume', 'toothpaste', 'trimmer', 'razor'] },
    { cat: 'baby', words: ['baby', 'diaper', 'infant', 'toddler', 'newborn', 'feeding', 'stroller'] },
    { cat: 'pets', words: ['dog', 'cat', 'pet', 'puppy', 'kitten', 'fish', 'aquarium', 'treats'] }
  ];
  if (/\b(smartwatch|smart watch|fitness band)\b/.test(text)) return 'electronics';

  var cat = 'home';
  for (const r of rules) {
    if (r.words.some(w => text.includes(w))) { cat = r.cat; break; }
  }
  return cat;
}

function detectSubcategory(name, breadcrumb, cat) {
  var text = (name + ' ' + breadcrumb).toLowerCase();
  var subRules = {
    beauty: [
      { sub: "Women's Skincare", words: ['women serum', 'women moisturizer', 'women sunscreen', 'women face wash', 'ladies cream', 'women cleanser'] },
      { sub: "Men's Skincare", words: ['men face wash', "men's face wash", 'mens face', 'men sunscreen', 'men moisturizer', 'men serum'] },
      { sub: 'Makeup', words: ['foundation', 'lipstick', 'mascara', 'eyeshadow', 'concealer', 'primer', 'blush', 'compact', 'kajal', 'eyeliner'] },
      { sub: 'Nails', words: ['nail polish', 'nail art', 'manicure', 'pedicure'] },
      { sub: 'Tools & Brushes', words: ['brush set', 'makeup brush', 'sponge', 'applicator', 'beauty tool', 'mirror'] },
      { sub: '_auto_', words: ['_placeholder_'] }
    ],
    fashion: [
      { sub: "Men's Footwear", words: ['men shoe', "men's shoe", 'mens shoe', 'men sneaker', "men's sneaker", 'mens sneaker', 'men sandal', 'men slipper', 'men boot', 'mens boot', 'men loafer', 'mens loafer', 'men floater'] },
      { sub: "Women's Footwear", words: ['women shoe', "women's shoe", 'womens shoe', 'women sneaker', 'women sandal', 'women heel', 'women slipper', 'women boot', 'ladies shoe', 'ladies sandal', 'ladies heel'] },
      { sub: "Men's Ethnic Wear", words: ['men kurta', "men's kurta", 'mens kurta', 'sherwani', 'dhoti', 'men ethnic'] },
      { sub: "Women's Ethnic Wear", words: ['women kurta', 'kurti', 'saree', 'lehenga', 'salwar', 'dupatta', 'women ethnic', 'ladies kurta', 'anarkali'] },
      { sub: "Men's Western Wear", words: ["men's t-shirt", 'mens tshirt', 'men shirt', "men's shirt", 'men jeans', "men's jeans", 'mens jeans', 'men jacket', 'men hoodie', 'men shorts', 'mens shorts'] },
      { sub: "Women's Western Wear", words: ['women top', "women's top", 'women jeans', 'women dress', 'women jacket', 'women shorts', 'women crop', 'women hoodie', 'ladies top', 'jumpsuit', 'romper'] },
      { sub: "Men's Sportswear", words: ['men track', "men's track", 'mens track', 'men gym', 'men sport', 'men running', 'men athletic'] },
      { sub: "Women's Sportswear", words: ['women track', 'women gym', 'women sport', 'women yoga', 'women running', 'women athletic', 'ladies track'] },
      { sub: 'Accessories', words: ['watch', 'handbag', 'bag', 'clutch', 'wallet', 'belt', 'cap', 'sunglasses', 'scarf', 'stole', 'jewellery', 'jewelry', 'ring', 'bracelet', 'necklace'] },
      { sub: 'Kids Wear', words: ['kids', 'children', 'infant wear', 'baby girl', 'baby boy'] },
      { sub: '_auto_', words: ['_placeholder_'] }
    ],
    home: [
      { sub: 'Cookware', words: ['kadai', 'pan', 'tawa', 'pot', 'utensil', 'cookware', 'cooker', 'wok', 'frying'] },
      { sub: 'Kitchen Appliances', words: ['mixer', 'grinder', 'blender', 'juicer', 'toaster', 'oven', 'microwave', 'induction', 'air fryer', 'kettle'] },
      { sub: 'Home Decor', words: ['decor', 'wall art', 'vase', 'candle', 'frame', 'showpiece', 'painting', 'sculpture', 'clock', 'mirror'] },
      { sub: 'Furniture', words: ['furniture', 'table', 'chair', 'shelf', 'desk', 'rack', 'cabinet', 'sofa', 'bean bag', 'stool'] },
      { sub: 'Storage & Organization', words: ['storage', 'organizer', 'box', 'basket', 'hanger', 'container', 'drawer', 'stand'] },
      { sub: 'Bedding & Linen', words: ['bedsheet', 'pillow', 'mattress', 'blanket', 'comforter', 'curtain', 'towel', 'cushion', 'quilt'] },
      { sub: 'Cleaning Supplies', words: ['vacuum', 'mop', 'broom', 'cleaner', 'wipe', 'duster', 'spray', 'bucket'] },
      { sub: 'Lighting', words: ['lamp', 'light', 'bulb', 'led', 'chandelier', 'torch', 'lantern'] },
      { sub: 'Garden & Outdoor', words: ['garden', 'plant', 'planter', 'outdoor', 'lawn', 'sprinkler', 'hose'] }
    ],
    electronics: [
      { sub: 'Smartphones', words: ['phone', 'mobile', 'smartphone', 'iphone', 'samsung', 'redmi', 'oneplus', 'vivo', 'oppo', 'realme', 'poco'] },
      { sub: 'Laptops & Computers', words: ['laptop', 'notebook', 'chromebook', 'macbook', 'desktop', 'computer', 'monitor', 'keyboard', 'mouse'] },
      { sub: 'Wireless Headphones', words: ['wireless earbuds', 'bluetooth earbuds', 'wireless headphone', 'bluetooth headphone', 'airpods', 'neckband', 'tws'] },
      { sub: 'Wired Headphones', words: ['wired earphone', 'wired headphone', '3.5mm', 'in-ear wired'] },
      { sub: 'Smartwatches', words: ['smartwatch', 'smart watch', 'fitness band', 'fitness tracker', 'smart band'] },
      { sub: 'Bluetooth Speakers', words: ['speaker', 'soundbar', 'bluetooth speaker', 'portable speaker', 'home theatre'] },
      { sub: 'Cameras', words: ['camera', 'dslr', 'gopro', 'webcam', 'tripod', 'lens', 'mirrorless'] },
      { sub: 'Chargers & Cables', words: ['charger', 'cable', 'adapter', 'usb', 'type-c', 'lightning'] },
      { sub: 'Power Banks', words: ['power bank', 'portable charger', 'battery pack'] },
      { sub: 'Smart Home', words: ['alexa', 'echo', 'smart plug', 'smart bulb', 'smart home', 'google home'] }
    ],
    books: [
      { sub: 'Fiction', words: ['fiction', 'novel', 'story', 'thriller', 'mystery', 'romance', 'fantasy', 'sci-fi'] },
      { sub: 'Non-Fiction', words: ['non-fiction', 'biography', 'history', 'memoir', 'documentary', 'travel', 'cooking'] },
      { sub: 'Self-Help', words: ['self-help', 'self help', 'motivation', 'business', 'leadership', 'success', 'habit', 'productivity', 'mindset'] },
      { sub: 'Educational', words: ['education', 'textbook', 'study', 'exam', 'competitive', 'ncert', 'syllabus', 'class', 'grade'] },
      { sub: 'Kids Books', words: ['kids book', 'children book', 'story book', 'coloring', 'colouring', 'picture book'] },
      { sub: 'Action Toys', words: ['toy', 'action figure', 'doll', 'car', 'lego', 'building', 'remote control', 'rc car', 'nerf'] },
      { sub: 'Board Games', words: ['board game', 'chess', 'carrom', 'monopoly', 'card game', 'uno', 'scrabble'] },
      { sub: 'Puzzles', words: ['puzzle', 'jigsaw', 'rubik', 'brain teaser', 'cube'] }
    ],
    personal: [
      { sub: "Men's Grooming", words: ['trimmer', 'razor', 'shaving', 'beard', 'aftershave', "men's grooming", 'men trimmer'] },
      { sub: "Women's Hygiene", words: ['sanitary', 'pad', 'tampon', 'intimate wash', 'feminine', 'women hygiene'] },
      { sub: 'Oral Care', words: ['toothpaste', 'toothbrush', 'mouthwash', 'dental', 'floss', 'tongue cleaner'] },
      { sub: "Women's Hair Care", words: ['women shampoo', 'women conditioner', 'women hair oil', 'ladies hair'] },
      { sub: "Men's Hair Care", words: ['men shampoo', "men's shampoo", 'men hair oil', "men's hair", 'men conditioner'] },
      { sub: 'Body Care', words: ['body wash', 'soap', 'lotion', 'body cream', 'scrub', 'body butter', 'moisturizer'] },
      { sub: 'Health & Wellness', words: ['vitamin', 'supplement', 'protein', 'immunity', 'health', 'omega', 'multivitamin', 'probiotic'] },
      { sub: '_auto_', words: ['_placeholder_'] }
    ],
    baby: [
      { sub: 'Baby Boy Clothing', words: ['baby boy', 'boy romper', 'boy bodysuit', 'boy onesie', 'boy frock'] },
      { sub: 'Baby Girl Clothing', words: ['baby girl', 'girl romper', 'girl bodysuit', 'girl onesie', 'girl frock', 'girl dress'] },
      { sub: 'Feeding Essentials', words: ['feeding', 'bottle', 'sipper', 'breast pump', 'formula', 'sterilizer', 'warmer'] },
      { sub: 'Diapers & Wipes', words: ['diaper', 'nappy', 'wipes', 'diaper pant'] },
      { sub: 'Baby Toys', words: ['baby toy', 'rattle', 'teether', 'play mat', 'baby play', 'crib toy', 'musical toy'] },
      { sub: 'Bath & Skin Care', words: ['baby bath', 'baby lotion', 'baby oil', 'baby cream', 'baby powder', 'baby soap', 'baby shampoo', 'baby wash'] },
      { sub: 'Gear & Safety', words: ['stroller', 'car seat', 'walker', 'carrier', 'baby monitor', 'gate', 'crib', 'high chair'] }
    ],
    pets: [
      { sub: 'Dog Food', words: ['dog food', 'puppy food', 'dog treat', 'dog biscuit', 'dog kibble', 'puppy treat'] },
      { sub: 'Dog Accessories', words: ['dog collar', 'dog leash', 'dog bed', 'dog toy', 'dog bowl', 'dog coat', 'puppy collar', 'puppy toy'] },
      { sub: 'Cat Food', words: ['cat food', 'kitten food', 'cat treat', 'cat kibble'] },
      { sub: 'Cat Accessories', words: ['cat collar', 'cat toy', 'cat bed', 'cat litter', 'cat tree', 'cat bowl', 'scratching post'] },
      { sub: 'Fish & Aquarium', words: ['fish', 'aquarium', 'tank', 'marine', 'fish food', 'fish tank', 'aquarium filter'] },
      { sub: 'Bird Supplies', words: ['bird', 'parrot', 'cage', 'bird food', 'bird seed', 'bird toy', 'perch'] },
      { sub: 'Pet Grooming', words: ['pet grooming', 'pet shampoo', 'pet brush', 'nail clipper', 'grooming kit', 'flea'] },
      { sub: '_auto_', words: ['_placeholder_'] }
    ]
  };
  var rules = subRules[cat] || [];
  for (var r of rules) {
    if (r.sub === '_auto_') continue;
    if (r.words.some(function(w) { 
      var escapedW = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('\\b' + escapedW + '\\b').test(text); 
    })) return r.sub;
  }
  // Smart fallback: detect gender + type independently and combine
  if (cat === 'fashion') {
    var gender = '';
    if (text.includes('unisex')) gender = 'Unisex';
    else if (text.includes("men's") || text.includes('mens') || text.includes(' men ') || text.includes('male') || text.includes('boys')) gender = "Men's";
    else if (text.includes('women') || text.includes('ladies') || text.includes('girl') || text.includes('female')) gender = "Women's";
    else if (text.includes('kids') || text.includes('children')) gender = 'Kids';

    var type = '';
    if (/\b(shoe|sneaker|sandal|slipper|boot|heel|loafer|footwear|floater|crocs|flip flop)\b/.test(text)) type = 'Footwear';
    else if (/\b(kurta|kurti|saree|lehenga|ethnic|sherwani|dhoti|salwar|dupatta|anarkali)\b/.test(text)) type = 'Ethnic Wear';
    else if (/\b(jeans|denim|shorts|t-shirt|tshirt|shirt|jacket|hoodie|dress|top|crop|trouser|pant|jumpsuit)\b/.test(text)) type = 'Western Wear';
    else if (/\b(sport|gym|track|yoga|running|athletic)\b/.test(text)) type = 'Sportswear';
    else if (/\b(watch|bag|wallet|belt|cap|sunglasses)\b/.test(text)) type = 'Accessories';
    if (gender && type) return gender + ' ' + type;
    if (gender === 'Kids') return 'Kids Wear';
    if (type) return (gender || "Men's") + ' ' + type;
    if (gender) return gender + ' Western Wear';
  }
  if (cat === 'beauty') {
    var g = '';
    if (text.includes("men's") || text.includes('mens') || text.includes(' men ') || text.includes(' male')) g = "Men's";
    else if (text.includes('women') || text.includes('ladies') || text.includes('girl') || text.includes('female')) g = "Women's";
    var t = '';
    if (text.includes('serum') || text.includes('moisturizer') || text.includes('sunscreen') || text.includes('face wash') || text.includes('cleanser') || text.includes('cream') || text.includes('toner')) t = 'Skincare';
    else if (text.includes('shampoo') || text.includes('conditioner') || text.includes('hair mask') || text.includes('hair serum') || text.includes('hair oil')) t = 'Haircare';
    else if (text.includes('perfume') || text.includes('fragrance') || text.includes('cologne') || text.includes('attar') || text.includes('deodorant') || text.includes('deo')) t = 'Fragrance';
    if (g && t) return g + ' ' + t;
    if (t) return (g || "Women's") + ' ' + t;
  }
  if (cat === 'personal') {
    var gp = '';
    if (text.includes("men's") || text.includes('mens') || text.includes(' men ') || text.includes('male')) gp = "Men's";
    else if (text.includes('women') || text.includes('ladies') || text.includes('girl') || text.includes('female')) gp = "Women's";
    if (text.includes('hair oil') || text.includes('shampoo') || text.includes('conditioner') || text.includes('hair')) {
      return (gp || "Women's") + ' Hair Care';
    }
  }
  if (cat === 'pets') {
    var animal = '';
    if (text.includes('dog') || text.includes('puppy')) animal = 'Dog';
    else if (text.includes('cat') || text.includes('kitten')) animal = 'Cat';
    if (animal) {
      if (text.includes('food') || text.includes('treat') || text.includes('kibble') || text.includes('biscuit') || text.includes('chew')) return animal + ' Food';
      return animal + ' Accessories';
    }
  }
  return '';
}



/* ═══════════════════════════════════
   INIT
═══════════════════════════════════ */
// One-time migration: auto-detect subcategories for existing products (global flag in Firestore)
async function migrateSubcategories() {
  try {
    // Check global flag in Firestore
    var flagDoc = await db.collection('settings').doc('migration').get();
    if (flagDoc.exists && flagDoc.data().subcat_v2) return;

    var snap = await db.collection('products').get();
    var batch = db.batch();
    var count = 0;
    snap.docs.forEach(function(doc) {
      var d = doc.data();
      if (!d.subcat || d.subcat === 'Women\'s Wear' || d.subcat === 'Men\'s Wear') {
        var newSub = detectSubcategory(d.name || '', '', d.cat || 'home');
        if (newSub) {
          batch.update(doc.ref, { subcat: newSub });
          count++;
        }
      }
    });
    if (count > 0) {
      await batch.commit();
      console.log('Migrated subcategories for', count, 'products');
    }
    // Set global flag so it never runs again on any device
    await db.collection('settings').doc('migration').set({ subcat_v2: true }, { merge: true });
  } catch(e) { console.error('Migration:', e); }
}

async function init() {
  renderHeroPills();
  renderNicheCheckboxes();
  initProductsListener();
  handleQuickAdd();
  // Run migrations after auth resolves
  setTimeout(function() {
    migrateSubcategories();
    // runAdminMigrations triggered by onAuthStateChanged instead
  }, 3000);
}

// One-time migration: fix prices, deduplicate products, and fix miscategorized items
async function runAdminMigrations() {
  try {
    var user = firebase.auth().currentUser;
    if (!user) return; // Only run when admin logged in

    var flagDoc = await db.collection('settings').doc('migration').get();
    if (flagDoc.exists && flagDoc.data().admin_fixes_v1) return;

    console.log('🔧 Running admin data cleanup...');
    var snap = await db.collection('products').get();
    var batch = db.batch();
    
    var seenProducts = new Map(); // Store by ASIN/Link to find duplicates
    var stats = { fixedPrice: 0, deletedDupes: 0, fixedCat: 0 };

    snap.docs.forEach(function(doc) {
      var d = doc.data();
      
      // 1. DEDUPLICATION
      // Extract ASIN from link or use exact name as fallback identifier
      var identifier = d.name;
      if (d.link) {
        var m = d.link.match(/\/dp\/([A-Z0-9]{10})/i);
        if (m) identifier = m[1]; // Use ASIN
      }
      
      if (seenProducts.has(identifier)) {
        // We already have this product! Delete the duplicate.
        batch.delete(doc.ref);
        stats.deletedDupes++;
        console.log('  🗑️ Deleted duplicate:', d.name?.substring(0, 40));
        return; // Skip other checks for deleted docs
      }
      seenProducts.set(identifier, true);

      // 2. CATEGORY FIX (Pet Kennel in Fashion)
      var updates = {};
      var needsUpdate = false;
      
      if (d.cat === 'fashion' && (d.name.toLowerCase().includes('kennel') || d.name.toLowerCase().includes('pet '))) {
        updates.cat = 'pets';
        updates.subcat = 'Dog Accessories';
        needsUpdate = true;
        stats.fixedCat++;
        console.log('  🏷️ Fixed category for:', d.name?.substring(0, 40), '→ pets');
      }

      // 3. PRICE FIX
      var p = Number(d.price) || 0;
      var w = Number(d.was) || 0;
      if (p > 0) {
        var newW = w;
        if (newW > 50000 && newW > p * 20) newW = Math.round(newW / 100);
        if (newW <= p) newW = Math.round(p * 1.3);

        if (newW !== w) {
          updates.was = newW;
          needsUpdate = true;
          stats.fixedPrice++;
          console.log('  💰 Price fix:', d.name?.substring(0, 40), '₹' + w, '→ ₹' + newW);
        }
      }

      if (needsUpdate) {
        batch.update(doc.ref, updates);
      }
    });

    if (stats.fixedPrice > 0 || stats.deletedDupes > 0 || stats.fixedCat > 0) {
      await batch.commit();
      console.log('✅ Admin cleanup complete:', stats);
    } else {
      console.log('✅ Data is already perfectly clean!');
    }
    await db.collection('settings').doc('migration').set({ admin_fixes_v1: true }, { merge: true });
  } catch(e) { console.error('Admin migration error:', e); }
}

init();
