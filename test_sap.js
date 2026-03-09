require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.SAP_API_KEY;
    console.log("Key loaded:", !!key);
    if (key) {
        console.log("Length:", key.length, "Starts with space:", key.startsWith(' '));
    }
    
    try {
        const url = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/A_BillingDocumentItem?$top=5';
        const res = await axios.get(url, {
            headers: {
                'APIKey': key ? key.trim() : '',
                'Accept': 'application/json'
            }
        });
        console.log("SAP Response code:", res.status);
        console.log("Found records:", res.data.d.results.length);
    } catch(err) {
        console.error("Erro SAP API:", err.response ? err.response.status : err.message);
        if (err.response) {
            console.error("Motivo:", err.response.data);
        }
    }
}
test();
