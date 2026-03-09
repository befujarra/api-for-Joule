const axios = require('axios');
require('dotenv').config();
const auth = {
    username: process.env.SAP_USERNAME.trim(),
    password: process.env.SAP_PASSWORD.trim()
};
const url = 'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_GLACCOUNTLINEITEM/GLAccountLineItem?$top=1';

axios.get(url, { auth, headers: { Accept: 'application/json' } })
    .then(r => console.log('GL Item:', JSON.stringify(r.data.d.results[0], null, 2)))
    .catch(e => console.log('Error:', e.message));
