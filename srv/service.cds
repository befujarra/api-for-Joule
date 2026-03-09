// =============================================================================
// SAP CAP Margin Analysis - Service Definition
// =============================================================================
// Exposes the MarginAnalysisService with a single action/function endpoint
// that triggers the full data pipeline: API consumption → normalization →
// correlation → margin calculation → classification.
// =============================================================================

using margin.analysis from '../db/schema';

// ---------------------------------------------------------------------------
// MarginAnalysisService
// Main service consumed by the Joule AI agent
// ---------------------------------------------------------------------------
@protocol: 'rest'
service MarginAnalysisService @(path: '/margin-analysis') {

    // Read-only projections of the underlying entities (for reference/debug)
    @readonly entity MaterialSales        as projection on analysis.MaterialSales;
    @readonly entity MaterialCosts        as projection on analysis.MaterialCosts;
    @readonly entity MaterialMarginAnalysis as projection on analysis.MaterialMarginAnalysis;

    // -----------------------------------------------------------------------
    // Main endpoint: GET /margin-analysis/analyze()
    // Executes the entire pipeline and returns structured JSON
    // -----------------------------------------------------------------------
    type CurrentPeriod {
        quantitySold      : Double;
        baseUnit          : String;
        valuationQuantity : Double;
        revenue           : Double;
        cost              : Double;
        grossMargin       : Double;
        grossMarginPercent: Double;
    }

    type HistoryRecord {
        period        : String;
        revenue       : Double;
        cost          : Double;
        marginPercent : Double;
    }

    type RevenueBreakdown {
        billingDocuments : Integer;
        averagePrice     : Double;
    }

    type CostBreakdown {
        materialCost  : Double;
        overheadCost  : Double;
        logisticsCost : Double;
    }

    type Metrics {
        unitRevenue : Double;
        unitCost    : Double;
        unitMargin  : Double;
        marginTrend : String;
    }

    type Dimensions {
        companyCode    : String;
        plant          : String;
        profitCenter   : String;
        costCenter     : String;
        segment        : String;
        functionalArea : String;
    }

    type FiscalContext {
        fiscalYear       : String;
        fiscalPeriod     : String;
        fiscalYearPeriod : String;
        postingDate      : String;
        documentDate     : String;
    }

    type GLContext {
        ledger           : String;
        ledgerFiscalYear : String;
        chartOfAccounts  : String;
        glAccountType    : String;
    }

    type ProductContext {
        product  : String;
        baseUnit : String;
        plant    : String;
    }

    type CurrencyContext {
        transactionCurrency : String;
        companyCodeCurrency : String;
        globalCurrency      : String;
    }

    type SalesContext {
        salesOrganization   : String;
        distributionChannel : String;
        billingDocuments    : Integer;
        averagePrice        : Double;
    }

    type AccountBreakdownItem {
        glAccount               : String;
        glAccountType           : String;
        amount                  : Double;
        category                : String;
        offsettingAccount       : String;
        businessTransactionType : String;
        fiscalYear              : String;
        fiscalPeriod            : String;
        postingDate             : String;
        profitCenter            : String;
        costCenter              : String;
        product                 : String;
        ledger                  : String;
    }

    type DocumentContext {
        accountingDocument      : String;
        sourceReferenceDocument : String;
        referenceDocumentType   : String;
    }

    type MarginResult {
        materialId       : String;
        classification   : String;
        dimensions       : Dimensions;
        glContext        : GLContext;
        fiscalContext    : FiscalContext;
        productContext   : ProductContext;
        currencyContext  : CurrencyContext;
        salesContext     : SalesContext;
        documentContext  : DocumentContext;
        currentPeriod    : CurrentPeriod;
        history          : array of HistoryRecord;
        revenueBreakdown : RevenueBreakdown;
        costBreakdown    : CostBreakdown;
        accountBreakdown : array of AccountBreakdownItem;
        metrics          : Metrics;
    }

    type AnalysisResponse {
        analysisDate   : String;
        analysisType   : String;
        currency       : String;
        totalMaterials : Integer;
        materials      : array of MarginResult;
    }

    function analyze(
        material: String, 
        periodStart: String,
        periodEnd: String,
        plant: String,
        mock: Boolean
    ) returns AnalysisResponse;
}
