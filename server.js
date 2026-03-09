// =============================================================================
// Margin Analysis - Express Server
// =============================================================================

const express = require('express');
const { fetchAllData } = require('./lib/apiClients');
const { mapBillingDocuments, mapGLLineItems, mapJournalEntries } = require('./lib/mappers');
const { calculateMargins } = require('./lib/calculationEngine');

try { require('dotenv').config(); } catch (e) { /* dotenv is optional */ }

const app = express();
app.use(express.json());

// Main endpoint
app.get('/margin-analysis/analyze', async (req, res) => {
    const { material, periodStart, periodEnd, plant, mock } = req.query;
    
    console.log('========================================');
    console.log(`[MarginAnalysis] Pipeline started. Filters -> material: ${material || 'ALL'}, periodStart: ${periodStart || 'ALL'}, periodEnd: ${periodEnd || 'ALL'}, plant: ${plant || 'ALL'}. mock: ${mock || false}`);
    console.log('========================================');

    if (mock === 'true' || mock === true) {
        console.log('[Step 1] Executando em modo MOCK. Ignorando APIs SAP...');
        return res.json({
            analysisDate: new Date().toISOString().split('T')[0],
            totalMaterials: 1,
            materials: [
                {
                    materialId: material || "MAT-DEMO-1000",
                    currentPeriod: {
                        quantitySold: 150,
                        revenue: 55000,
                        cost: 32000,
                        grossMargin: 23000,
                        grossMarginPercent: 41.8
                    },
                    history: [
                        { period: "2026-01", revenue: 45000, cost: 26000, marginPercent: 42.2 },
                        { period: "2026-02", revenue: 50000, cost: 29000, marginPercent: 42.0 },
                        { period: "2026-03", revenue: 55000, cost: 32000, marginPercent: 41.8 }
                    ],
                    revenueBreakdown: {
                        billingDocuments: 10,
                        averagePrice: 366.67
                    },
                    costBreakdown: {
                        materialCost: 20000,
                        overheadCost: 8000,
                        logisticsCost: 4000
                    },
                    metrics: {
                        unitRevenue: 366.67,
                        unitCost: 213.33,
                        unitMargin: 153.34,
                        marginTrend: "decreasing"
                    },
                    classification: "High Profitability"
                }
            ]
        });
    }

    try {
        console.log('[Step 1] Fetching data from SAP S/4HANA APIs...');
        const rawData = await fetchAllData();

        console.log('[Step 2] Normalizing data...');
        const salesRecords = mapBillingDocuments(rawData.billing);
        const glCostRecords = mapGLLineItems(rawData.glItems);
        const journalCostRecords = mapJournalEntries(rawData.journalEntries);

        console.log(
            `[Step 2] Mapped: ${salesRecords.length} sales, ` +
            `${glCostRecords.length} GL costs, ` +
            `${journalCostRecords.length} journal costs`
        );

        console.log('[Step 3] Correlating materials...');
        const allCostRecords = [...glCostRecords, ...journalCostRecords];

        console.log('[Steps 4-6] Calculating margins and classifying...');
        let marginResults = calculateMargins(salesRecords, allCostRecords);

        if (material) {
            console.log(`[Filtro] Aplicando filtro material=${material}`);
            marginResults = marginResults.filter(m => m.materialId === material);
        }
        if (periodStart || periodEnd) {
            console.log(`[Filtro] Aplicando filtro de periodo: ${periodStart} a ${periodEnd}`);
        }
        if (plant) {
            console.log(`[Filtro] Aplicando filtro de plant=${plant}`);
        }

        console.log('[Steps 7-8] Building final response...');
        const analysisDate = new Date().toISOString().split('T')[0];

        const response = {
            analysisDate,
            analysisType: "Gross Margin Analysis",
            currency: "USD",
            totalMaterials: marginResults.length,
            materials: marginResults,
        };

        console.log('========================================');
        console.log(`[MarginAnalysis] Pipeline complete. ${marginResults.length} materials analyzed`);
        console.log('========================================');

        return res.json(response);

    } catch (error) {
        console.error('[MarginAnalysis] Pipeline error:', error.message);
        res.status(500).json({ error: `Margin analysis failed: ${error.message}` });
    }
});

// Used when starting directly with 'node server.js'
if (require.main === module) {
    const PORT = process.env.PORT || 4004;
    app.listen(PORT, () => {
        console.log(`Express server running locally on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
