const axios = require('axios');
require('dotenv').config();
const auth = {
    username: process.env.SAP_USERNAME.trim(),
    password: process.env.SAP_PASSWORD.trim()
};
const url = 'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';

axios.get(`${url}/$metadata`, { auth, headers: { Accept: 'application/json' } })
    .then(r => {
        const data = String(r.data);
        const match = data.match(/<EntitySet.*?Name="([^"]+)"/);
        console.log("EntitySet Found:", match ? match[1] : "None");
        
        // try to get JournalEntryItemBasic
        axios.get(`${url}/JournalEntryItemBasic?$top=1`, { auth, headers: { Accept: 'application/json' } })
            .then(r2 => console.log('JournalEntryItemBasic OK'))
            .catch(e => console.log('JournalEntryItemBasic Error:', e.response ? e.response.status : e.message));
        
        // try A_
        axios.get(`${url}/A_JournalEntryItemBasic?$top=1`, { auth, headers: { Accept: 'application/json' } })
            .then(r2 => console.log('A_JournalEntryItemBasic OK'))
            .catch(e => console.log('A_JournalEntryItemBasic Error:', e.response ? e.response.status : e.message));
    })
    .catch(e => console.log('Metadata error', e.response ? e.response.status : e.message));
