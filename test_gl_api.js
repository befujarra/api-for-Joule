require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.SAP_API_KEY.trim();
    const opts = { headers: { 'APIKey': key, 'Accept': 'application/json' } };
    
    // Testing user's suggestion for GL Account Line Item
    const urls = [
        'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_GLACCOUNTLINEITEM/GLAccountLineItem?$top=1',
        // Also testing without basic in Journal entry just in case
        'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/A_JournalEntryItemBasic?$top=1'
    ];
    
    for (const url of urls) {
        console.log(`\n--- Testing ${url} ---`);
        try {
            const res = await axios.get(url, opts);
            console.log("Success! Status:", res.status);
            if (res.data && res.data.d && res.data.d.results && res.data.d.results.length > 0) {
                console.log("Available fields in first record:");
                console.log(Object.keys(res.data.d.results[0]).join(', '));
            } else {
                console.log("Response successful but no records returned:", res.data);
            }
        } catch(e) {
            console.log("Failed with status:", e.response ? e.response.status : e.message);
            if(e.response && e.response.data) {
               console.log("Error detail:", JSON.stringify(e.response.data));
            }
        }
    }
}
test();
