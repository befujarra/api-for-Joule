const axios = require('axios');
require('dotenv').config();

const auth = {
    username: process.env.SAP_USERNAME.trim(),
    password: process.env.SAP_PASSWORD.trim()
};
const url = 'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';

axios.get(`${url}?$format=json`, { auth })
    .then(r => console.log('Service Document:', JSON.stringify(r.data.d.EntitySets || r.data.d, null, 2)))
    .catch(e => console.log('Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message));
