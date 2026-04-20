require('dotenv').config();
const crypto = require('crypto');
const https = require('https');

const ACCESS_KEY  = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY  = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const HOST        = 'webservices.amazon.in';
const REGION      = 'eu-west-1';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.log('Error: Amazon Credentials missing in .env');
  process.exit(1);
}

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

function checkPAAPI() {
  console.log(`Pinging Amazon PA-API...`);
  console.log(`Key setup: ${ACCESS_KEY.substring(0, 5)}...`);
  console.log(`Tag: ${PARTNER_TAG}\n`);

  const body = JSON.stringify({
    Keywords: 'iPhone',
    SearchIndex: 'Electronics',
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.in',
    ItemCount: 1,
    Resources: [
      'ItemInfo.Title',
      'Images.Primary.Large',
      'Offers.Listings.Price',
      'Offers.Listings.SavingBasis'
    ]
  });

  const headers = signRequest(body);
  const options = { hostname: HOST, path: '/paapi5/searchitems', method: 'POST', headers };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log(`HTTP Status: ${res.statusCode}`);
      const json = JSON.parse(data);
      
      if (json.Errors) {
        console.error('❌ API Error:');
        console.log(JSON.stringify(json.Errors, null, 2));
        return;
      } 
      
      if (json.SearchResult && json.SearchResult.Items && json.SearchResult.Items.length > 0) {
        const item = json.SearchResult.Items[0];
        console.log('✅ API Request Success!');
        console.log('--- Item Check ---');
        console.log(`Title: ${item.ItemInfo?.Title?.DisplayValue}`);
        
        const offers = item.Offers;
        if (!offers) {
          console.error('⚠️  Empty "Offers" ❌ (No sales yet OR wrong request)');
        } else if (!offers.Listings || offers.Listings.length === 0) {
          console.error('⚠️  Missing "Listings" ❌ (No sales yet OR wrong request)');
        } else {
          const price = offers.Listings[0].Price;
          if (price) {
            console.log('💰 Price Data Found:');
            console.log(JSON.stringify(price, null, 2));
            if (price.Currency !== 'INR') {
              console.warn(`🚨 Warning: Currency is ${price.Currency}, expected INR.`);
            }
          } else {
            console.error('❌ "Offers.Listings.Price" is missing from the response.');
          }
        }
        
        console.log('\nFull First Item JSON:');
        console.log(JSON.stringify(item, null, 2));
      } else {
        console.log('❓ No items found or unexpected response:');
        console.log(JSON.stringify(json, null, 2));
      }
    });
  });

  req.on('error', (e) => {
    console.error('Network Error:', e.message);
  });
  req.write(body);
  req.end();
}

checkPAAPI();
