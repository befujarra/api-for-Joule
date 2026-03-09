require('dotenv').config();
const { fetchGLAccountLineItems } = require('./lib/apiClients');
const { mapGLLineItems } = require('./lib/mappers');

async function test() {
    console.log("Fetching GL items...");
    const rawGLItems = await fetchGLAccountLineItems();
    console.log(`Fetched ${rawGLItems.length} raw GL items`);
    
    if (rawGLItems.length > 0) {
        console.log("Sample raw GL item:", JSON.stringify(rawGLItems[0]));
        
        let cogsCount = 0;
        rawGLItems.forEach(item => {
            if (item.GLAccount && (item.GLAccount.startsWith('5') || item.GLAccount.startsWith('6'))) {
                cogsCount++;
            }
        });
        console.log(`Matching COGS logic manually: ${cogsCount}`);
    }
    
    const mapped = mapGLLineItems(rawGLItems);
    console.log(`Mapped items: ${mapped.length}`);
}
test();
