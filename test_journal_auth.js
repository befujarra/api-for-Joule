const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let user = '', pass = '';
envFile.split('\n').forEach(line => {
    if (line.startsWith('SAP_USERNAME=')) user = line.split('=')[1].replace(/['"]/g, '').trim();
    if (line.startsWith('SAP_PASSWORD=')) pass = line.substring(line.indexOf('=')+1).replace(/['"]/g, '').trim(); // do not split by = here since pass might contain =
});

const auth = { username: user, password: pass };
const url = 'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV?$format=json';

axios.get(url, { auth })
    .then(r => {
        const collections = r.data.d.EntitySets || r.data.d;
        console.log("AVAILABLE ENTITY SETS IN JOURNAL ENTRY API:");
        console.log(JSON.stringify(collections, null, 2));
    })
    .catch(e => console.log("FAILED fetching root service doc:", e.response ? e.response.status + " " + e.response.statusText : e.message));
