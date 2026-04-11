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
    Keywords: 'laptop',
    SearchIndex: 'Electronics',
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.in',
    ItemCount: 1,
    Resources: ['ItemInfo.Title', 'Offers.Listings.Price']
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
      } else if (json.SearchResult) {
        console.log('✅ API is ALIVE and Working!');
        console.log('Successfully retrieved an item:');
        console.log(JSON.stringify(json.SearchResult.Items[0], null, 2));
      } else {
        console.log('❓ Unknown response:');
        console.log(json);
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
