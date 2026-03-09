require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.SAP_API_KEY.trim();
    
    // Exact URL from apiClients.js logic:
    const baseUrl = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV';
    const entitySet = 'A_BillingDocumentItem';
    const selectFields = 'BillingDocument,BillingDocumentItem,Material,BillingQuantity,NetAmount,TransactionCurrency,BillingDocumentDate';
    
    // This is how apiClients.js does it:
    const url = `${baseUrl}/${entitySet}?$format=json&$top=100&$skip=0&$select=${selectFields}`;
    
    console.log("URL:", url);
    try {
        const res = await axios.get(url, {
            headers: {
                'APIKey': key,
                'Accept': 'application/json'
            }
        });
        console.log("Success! Status:", res.status);
    } catch(err) {
        console.error("Error Status:", err.response ? err.response.status : err.message);
        if (err.response) {
            console.error("Payload:", err.response.data);
        }
    }
}
test();
