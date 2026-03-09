const axios = require('axios');

async function test() {
    try {
        console.log('Fetching analytical data from local CAP server...');
        const response = await axios.get('http://localhost:4004/odata/v4/margin-analysis/analyze(material=\'71\',periodStart=\'\',periodEnd=\'\',plant=\'\',mock=true)');
        console.log(JSON.stringify(response.data.materials[0], null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
