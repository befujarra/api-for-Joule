require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

async function test() {
    const key = process.env.SAP_API_KEY.trim();
    const opts = { headers: { 'APIKey': key, 'Accept': 'application/json' } };
    
    const url = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_GLACCOUNTLINEITEM/GLAccountLineItem?$top=50&$select=GLAccount,AmountInCompanyCodeCurrency,DebitCreditCode';
    
    try {
        const res = await axios.get(url, opts);
        const results = res.data.d.results;
        
        console.log(`Feched ${results.length} GL records`);
        
        let cogsCount = 0;
        const uniqueAccounts = new Set();
        
        results.forEach(r => {
            uniqueAccounts.add(r.GLAccount);
            if (r.GLAccount && (r.GLAccount.startsWith('5') || r.GLAccount.startsWith('6'))) {
                cogsCount++;
            }
        });
        
        console.log("Unique GL Accounts found:");
        console.log([...uniqueAccounts]);
        console.log(`Items matching '5' or '6': ${cogsCount}`);
        
    } catch(e) {
        console.log("Failed:", e.message);
    }
}
test();
