require('dotenv').config();
const { fetchAllData } = require('./lib/apiClients');
const { mapBillingDocuments, mapGLLineItems, mapJournalEntries } = require('./lib/mappers');
const { calculateMargins } = require('./lib/calculationEngine');

async function debug() {
    try {
        console.log("=== Fetching Data ===");
        const rawData = await fetchAllData();
        console.log(`Billing: ${rawData.billing.length}`);
        console.log(`GL: ${rawData.glItems.length}`);
        console.log(`Journal: ${rawData.journalEntries.length}`);

        console.log("\n=== Mapping ===");
        const salesRecords = mapBillingDocuments(rawData.billing);
        const glCostRecords = mapGLLineItems(rawData.glItems);
        const journalCostRecords = mapJournalEntries(rawData.journalEntries);
        
        console.log(`Sales Mapped: ${salesRecords.length}`);
        console.log(`GL Mapped: ${glCostRecords.length}`);
        console.log(`Journal Mapped: ${journalCostRecords.length}`);

        const allCostRecords = [...glCostRecords, ...journalCostRecords];
        
        console.log("\n=== Calculating Margin ===");
        const results = calculateMargins(salesRecords, allCostRecords);
        console.log(`Total materials calculated: ${results.length}`);
        
        const tg11 = results.find(m => m.materialId === 'TG11');
        if (tg11) {
             console.log("TG11 Found:", tg11);
        } else {
             console.log("TG11 NOT FOUND");
        }
        
    } catch(e) {
        console.error("Error during debug:", e);
    }
}
debug();
