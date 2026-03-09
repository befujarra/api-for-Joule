require('dotenv').config();
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 4004,
    path: encodeURI("/odata/v4/margin-analysis/analyze(materialId='TG11',mock=false)"),
    headers: {
        'Authorization': 'Basic YWxpY2U6YWxpY2U='
    }
};

const req = http.get(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            console.log(`Total materials: ${data.totalMaterials}`);
            if (data.totalMaterials > 0) {
              console.log("Found materials!");
            } else {
              console.log("No materials found. Let's see the logs of the server.");
            }
        } catch (e) {
            console.log("Response form server:", body);
        }
    });
});
req.on('error', e => console.error(e));
