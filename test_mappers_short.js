require('dotenv').config();
const { mapGLLineItems } = require('./lib/mappers');
const axios = require('axios');

async function test() {
    const key = process.env.SAP_API_KEY.trim();
    const url = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_GLACCOUNTLINEITEM/GLAccountLineItem?$top=50&$select=CompanyCode,GLAccount,AmountInCompanyCodeCurrency,DebitCreditCode,AccountingDocument,FiscalYear';
    try {
        const res = await axios.get(url, { headers: { 'APIKey': key, 'Accept': 'application/json' } });
        const rawGLItems = res.data.d.results;
        console.log(`Fetched ${rawGLItems.length} raw GL items via explicit select fields`);
        
        const mapped = mapGLLineItems(rawGLItems);
        console.log(`Mapped items: ${mapped.length}`);
        
        let cogsCount = 0;
        const uniq = new Set();
        rawGLItems.forEach(item => {
            uniq.add(item.GLAccount);
            if (item.GLAccount && (item.GLAccount.startsWith('5') || item.GLAccount.startsWith('6'))) {
                cogsCount++;
            }
        });
        console.log(`Matching COGS logic manually: ${cogsCount}`);
        console.log("Found GL Accounts:", [...uniq]);
    } catch(e) {
        console.error("error", e.message);
    }
}
test();
