// =============================================================================
// SAP CAP Margin Analysis - Data Model (Schema)
// =============================================================================
// Defines virtual/transient entities for material sales, costs, and margin
// analysis. These entities are NOT persisted — all data is fetched live from
// SAP S/4HANA Cloud APIs on each request.
//
// @cds.persistence.skip tells CDS not to create database tables for these
// entities, since they are populated programmatically in the service handler.
// =============================================================================

namespace margin.analysis;

// ---------------------------------------------------------------------------
// MaterialSales: Normalized billing document data from API_BILLING_DOCUMENT_SRV
// ---------------------------------------------------------------------------
@cds.persistence.skip
entity MaterialSales {
    key ID              : UUID;
        MaterialID      : String(40);
        BillingDocument : String(10);
        QuantitySold    : Decimal(15, 3);
        Revenue         : Decimal(15, 2);
        Currency        : String(5);
        BillingDate     : Date;
}

// ---------------------------------------------------------------------------
// MaterialCosts: Normalized cost data from GL Account Line Items and
//                Journal Entry Items APIs
// ---------------------------------------------------------------------------
@cds.persistence.skip
entity MaterialCosts {
    key ID                  : UUID;
        MaterialID          : String(40);
        CostAmount          : Decimal(15, 2);
        GLAccount           : String(10);
        AccountingDocument  : String(10);
        FiscalYear          : String(4);
}

// ---------------------------------------------------------------------------
// MaterialMarginAnalysis: Calculated margin analysis per material
// Populated by the calculation engine after correlating sales and costs
// ---------------------------------------------------------------------------
@cds.persistence.skip
entity MaterialMarginAnalysis {
    key MaterialID        : String(40);
        TotalRevenue      : Decimal(15, 2);
        TotalCost         : Decimal(15, 2);
        GrossMargin       : Decimal(15, 2);
        GrossMarginPercent: Decimal(5, 2);
        QuantitySold      : Decimal(15, 3);
        Classification    : String(30);
}
