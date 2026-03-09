const axios = require('axios');
require('dotenv').config();
const auth = {
    username: process.env.SAP_USERNAME.trim(),
    password: process.env.SAP_PASSWORD.trim()
};
const url = 'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';

axios.get(`${url}/JournalEntryItemBasic?$top=1`, { auth, headers: { Accept: 'application/json' } })
    .then(r2 => console.log('JournalEntryItemBasic OK'))
    .catch(e => console.log('JournalEntryItemBasic Error:', e.response ? e.response.status + " " + JSON.stringify(e.response.data).substring(0, 100) : e.message));

axios.get(`${url}/A_JournalEntryItemBasic?$top=1`, { auth, headers: { Accept: 'application/json' } })
    .then(r2 => console.log('A_JournalEntryItemBasic OK'))
    .catch(e => console.log('A_JournalEntryItemBasic Error:', e.response ? e.response.status + " " + JSON.stringify(e.response.data).substring(0, 100) : e.message));
