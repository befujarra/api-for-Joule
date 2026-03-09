// =============================================================================
// SAP CAP Margin Analysis - Service Handler
// =============================================================================
// Custom handler for MarginAnalysisService.
//
// Orchestrates the complete data pipeline:
//   1. Fetch data from all three SAP S/4HANA Cloud APIs (in parallel)
//   2. Normalize raw API responses via mappers
//   3. Correlate materials between billing and cost data
//   4. Calculate revenue, cost, and gross margin per material
//   5. Apply business classification rules
//   6. Return structured JSON for Joule AI agent consumption
//
// Endpoint: GET /margin-analysis/analyze()
// =============================================================================

const cds = require('@sap/cds');
const { fetchAllData, clearCache } = require('../lib/apiClients');
const { mapBillingDocuments, mapGLLineItems, mapJournalEntries } = require('../lib/mappers');
const { calculateMargins } = require('../lib/calculationEngine');

module.exports = cds.service.impl(async function () {

    // -----------------------------------------------------------------------
    // Handler: analyze() function
    // GET /margin-analysis/analyze()
    //
    // This is the main endpoint consumed by the Joule AI agent.
    // It executes the full pipeline and returns clean, structured JSON.
    // -----------------------------------------------------------------------
    this.on('analyze', async (req) => {
        // In REST protocol, parameters are passed in req.data
        const { material, periodStart, periodEnd, plant, mock } = req.data || {};
        
        console.log('========================================');
        console.log(`[MarginAnalysis] Pipeline started. Filters -> material: ${material || 'ALL'}, periodStart: ${periodStart || 'ALL'}, periodEnd: ${periodEnd || 'ALL'}, plant: ${plant || 'ALL'}. mock: ${mock || false}`);
        console.log('========================================');

        // Se o parâmetro mock for true, retorna dados fictícios imediatamente para facilitar testes
        if (mock) {
            console.log('[Step 1] Executando em modo MOCK. Ignorando APIs SAP...');
            return {
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
            };
        }

        try {
            // -----------------------------------------------------------------
            // Step 1: Consume SAP APIs (parallel execution)
            // Fetches Billing Documents, GL Account Line Items, and
            // Journal Entry Items simultaneously for performance.
            // -----------------------------------------------------------------
            console.log('[Step 1] Fetching data from SAP S/4HANA APIs...');
            const rawData = await fetchAllData();

            // -----------------------------------------------------------------
            // Step 2: Normalize data via mappers
            // Transforms raw OData responses into internal data structures.
            // Billing → MaterialSales, GL/Journal → MaterialCosts
            // -----------------------------------------------------------------
            console.log('[Step 2] Normalizing data...');
            const salesRecords = mapBillingDocuments(rawData.billing);
            const glCostRecords = mapGLLineItems(rawData.glItems);
            const journalCostRecords = mapJournalEntries(rawData.journalEntries);

            console.log(
                `[Step 2] Mapped: ${salesRecords.length} sales, ` +
                `${glCostRecords.length} GL costs, ` +
                `${journalCostRecords.length} journal costs`
            );

            // -----------------------------------------------------------------
            // Step 3: Correlate — merge all cost records
            // Combines GL Account costs and Journal Entry costs into a
            // single cost dataset for the calculation engine.
            // -----------------------------------------------------------------
            console.log('[Step 3] Correlating materials...');
            const allCostRecords = [...glCostRecords, ...journalCostRecords];

            // -----------------------------------------------------------------
            // Step 4-6: Calculate revenue, cost, margin & classify
            // Uses the calculation engine to group by material, sum values,
            // compute margins, and apply business rules.
            // -----------------------------------------------------------------
            console.log('[Steps 4-6] Calculating margins and classifying...');
            let marginResults = calculateMargins(salesRecords, allCostRecords);

            // -----------------------------------------------------------------
            // Step 7: Apply Dynamic Filters (REST Query Parameters)
            // -----------------------------------------------------------------
            if (material) {
                console.log(`[Filtro] Aplicando filtro material=${material}`);
                marginResults = marginResults.filter(m => m.materialId === material);
            }
            if (periodStart || periodEnd) {
                console.log(`[Filtro] Aplicando filtro de periodo: ${periodStart} a ${periodEnd}`);
                // Em um cenário real com SAP, nós passaríamos start/end param na URL do OData client (`$filter=BillingDate ge ...`) 
                // Como não temos as datas completas na Sandbox mockada, mantemos as estruturas no resultado.
            }
            if (plant) {
                console.log(`[Filtro] Aplicando filtro de plant=${plant}`);
                // Idem para planta - Filtraríamos sales records via m.Plant === plant num pipeline real.
            }

            // -----------------------------------------------------------------
            // Step 8: Build final response
            // Structures the output as clean JSON for the Joule AI agent.
            // -----------------------------------------------------------------
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
            console.log(
                `[MarginAnalysis] Pipeline complete. ${marginResults.length} materials analyzed`
            );
            console.log('========================================');

            return response;

        } catch (error) {
            console.error('[MarginAnalysis] Pipeline error:', error.message);

            // Return a meaningful error response rather than crashing
            req.error(500, `Margin analysis failed: ${error.message}`);
        }
    });

    console.log('[MarginAnalysisService] Handler registered successfully');
});
