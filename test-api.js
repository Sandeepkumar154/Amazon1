// Quick PA-API test — check if Offers resource is now accessible
require('dotenv').config();
const crypto = require('crypto');
const https = require('https');

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const HOST = 'webservices.amazon.in';
const REGION = 'eu-west-1';

function sign(key, msg) {
    return crypto.createHmac('sha256', key).update(msg, 'utf8').digest();
}

function getSignatureKey(key, dateStamp, region, service) {
    const kDate = sign('AWS4' + key, dateStamp);
    const kRegion = sign(kDate, region);
    const kService = sign(kRegion, service);
    return sign(kService, 'aws4_request');
}

async function testAPI() {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);

    const payload = JSON.stringify({
        "Keywords": "iPhone case",
        "SearchIndex": "All",
        "ItemCount": 1,
        "PartnerTag": PARTNER_TAG,
        "PartnerType": "Associates",
        "Marketplace": "www.amazon.in",
        "Resources": [
            "ItemInfo.Title",
            "Offers.Listings.Price",
            "Offers.Listings.MerchantInfo",
            "Offers.Listings.Condition"
        ]
    });

    const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${HOST}\nx-amz-date:${amzDate}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
    const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalRequest = `POST\n/paapi5/searchitems\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${dateStamp}/${REGION}/ProductAdvertisingAPI/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const signingKey = getSignatureKey(SECRET_KEY, dateStamp, REGION, 'ProductAdvertisingAPI');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            path: '/paapi5/searchitems',
            method: 'POST',
            headers: {
                'content-encoding': 'amz-1.0',
                'content-type': 'application/json; charset=utf-8',
                'host': HOST,
                'x-amz-date': amzDate,
                'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
                'Authorization': authHeader
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                
                console.log('\n========================================');
                console.log('  PA-API TEST — Offers Resource Check');
                console.log('========================================\n');
                
                if (result.Errors) {
                    console.log('❌ API ERROR:', result.Errors[0].Code);
                    console.log('   Message:', result.Errors[0].Message);
                    return resolve();
                }

                const items = result.SearchResult?.Items || [];
                if (items.length === 0) {
                    console.log('❌ No items returned');
                    return resolve();
                }

                const item = items[0];
                console.log('✅ Product:', item.ItemInfo?.Title?.DisplayValue || 'N/A');
                console.log('   ASIN:', item.ASIN);
                
                if (item.Offers && item.Offers.Listings && item.Offers.Listings.length > 0) {
                    const price = item.Offers.Listings[0].Price;
                    console.log('\n🎉🎉🎉 OFFERS DATA AVAILABLE! 🎉🎉🎉');
                    console.log('   Price:', price?.DisplayAmount || 'N/A');
                    console.log('   Amount:', price?.Amount || 'N/A');
                    console.log('   Currency:', price?.Currency || 'N/A');
                    console.log('\n   ✅ PA-API IS FULLY UNLOCKED!');
                } else {
                    console.log('\n❌ Offers data is STILL EMPTY');
                    console.log('   (API works but pricing is blocked)');
                    console.log('\n   → Reply to Amazon with your dashboard screenshot');
                    console.log('   → You have 12 shipped sales but Offers is still blocked');
                }
                
                console.log('\n========================================\n');
                resolve();
            });
        });

        req.on('error', (e) => {
            console.log('❌ Connection error:', e.message);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

testAPI();
