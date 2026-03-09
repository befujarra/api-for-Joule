// =============================================================================
// Data Mappers
// =============================================================================
// Transforms raw API responses into normalized internal data structures.
//
// Mapping rules:
//   - Billing Documents  → MaterialSales records
//   - GL Account Items   → MaterialCosts records (filtered to COGS accounts)
//   - Journal Entries    → MaterialCosts records (filtered to COGS accounts)
//
// COGS Identification:
//   GL Accounts starting with '5' or '6' are considered Cost of Goods Sold
//   (COGS) accounts. This follows common SAP chart-of-accounts conventions.
// =============================================================================

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Helper: Check if GL Account is a COGS account
// COGS accounts have GLAccount numbers starting with '5' or '6'
// ---------------------------------------------------------------------------
function _isCOGSAccount(glAccount) {
    if (!glAccount) return false;
    const trimmed = glAccount.toString().trim();
    return trimmed.startsWith('5') || trimmed.startsWith('6');
}

// ---------------------------------------------------------------------------
// Helper: Parse numeric value safely
// ---------------------------------------------------------------------------
function _parseNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

// ---------------------------------------------------------------------------
// Helper: Parse OData date fields
// SAP OData dates can come as "/Date(timestamp)/" or ISO strings
// ---------------------------------------------------------------------------
function _parseDate(dateValue) {
    if (!dateValue) return null;

    // Handle SAP OData format: /Date(1234567890000)/
    const match = dateValue.toString().match(/\/Date\((\d+)\)\//);
    if (match) {
        return new Date(parseInt(match[1], 10)).toISOString().split('T')[0];
    }

    // Handle ISO date string
    if (typeof dateValue === 'string' && dateValue.length >= 10) {
        return dateValue.substring(0, 10);
    }

    return null;
}

// =============================================================================
// Public Mapping Functions
// =============================================================================

/**
 * Map raw Billing Document items → MaterialSales records
 *
 * Source API: API_BILLING_DOCUMENT_SRV / A_BillingDocumentItem
 *
 * Mapping:
 *   Material           → MaterialID
 *   BillingDocument    → BillingDocument
 *   BillingQuantity    → QuantitySold
 *   NetAmount          → Revenue
 *   TransactionCurrency→ Currency
 *   BillingDocumentDate→ BillingDate
 *
 * @param {Array} rawBillingItems - Raw API response items
 * @returns {Array} Normalized MaterialSales records
 */
function mapBillingDocuments(rawBillingItems) {
    if (!Array.isArray(rawBillingItems)) return [];

    return rawBillingItems
        .filter((item) => item.Material && item.Material.trim() !== '')
        .map((item) => ({
            ID: uuidv4(),
            MaterialID: item.Material.trim(),
            BillingDocument: item.BillingDocument || '',
            QuantitySold: _parseNumber(item.BillingQuantity),
            Revenue: _parseNumber(item.NetAmount),
            Currency: item.TransactionCurrency || 'USD',
            BillingDate: _parseDate(item.BillingDocumentDate),
            SalesOrganization: item.SalesOrganization || '',
            DistributionChannel: item.DistributionChannel || '',
            // Additional sales context
            SalesDocument: item.SalesDocument || '',
            SalesDocumentItem: item.SalesDocumentItem || '',
            SoldToParty: item.SoldToParty || '',
            ShipToParty: item.ShipToParty || '',
            // Additional currency context
            CompanyCodeCurrency: item.CompanyCodeCurrency || '',
            GlobalCurrency: item.GlobalCurrency || '',
            // Additional document context
            ReferenceDocument: item.ReferenceDocument || '',
            ReferenceDocumentType: item.ReferenceDocumentType || '',
            // Additional GL context (if available, though less common for billing docs)
            GLAccount: item.GLAccount || '',
            ProfitCenter: item.ProfitCenter || '',
            CostCenter: item.CostCenter || ''
        }));
}

/**
 * Map raw GL Account Line Items → MaterialCosts records
 *
 * Source API: API_GLACCOUNTLINEITEM / A_GLAccountLineItem
 *
 * Only items whose GLAccount starts with '5' or '6' (COGS) are included.
 * Debit amounts are positive costs; Credit amounts are negative (reversals).
 *
 * Note: GL Account Line Items do NOT have a Material field.
 * These costs are correlated to materials later via AccountingDocument
 * or assigned as unallocated overhead.
 *
 * Mapping:
 *   GLAccount                    → GLAccount
 *   AmountInCompanyCodeCurrency  → CostAmount (sign adjusted by DebitCreditCode)
 *   AccountingDocument           → AccountingDocument
 *   FiscalYear                   → FiscalYear
 *
 * @param {Array} rawGLItems - Raw API response items
 * @returns {Array} Normalized MaterialCosts records
 */
function mapGLLineItems(rawGLItems) {
    if (!Array.isArray(rawGLItems)) return [];

    return rawGLItems
        .filter((item) => _isCOGSAccount(item.GLAccount))
        .map((item) => {
            // Debit (S) = positive cost, Credit (H) = negative cost (reversal)
            const amount = _parseNumber(item.AmountInCompanyCodeCurrency);
            const costAmount = item.DebitCreditCode === 'S' ? Math.abs(amount) : -Math.abs(amount);

            return {
                ID: uuidv4(),
                MaterialID: '', // GL items don't carry Material — resolved later
                CostAmount: costAmount,
                GLAccount: item.GLAccount || '',
                AccountingDocument: item.AccountingDocument || '',
                FiscalYear: item.FiscalYear || '',
                // New analytical dimensions
                CompanyCode: item.CompanyCode || '',
                Plant: item.Plant || '',
                ProfitCenter: item.ProfitCenter || '',
                CostCenter: item.CostCenter || '',
                Segment: item.Segment || '',
                FunctionalArea: item.FunctionalArea || '',
                // Fiscal context
                FiscalPeriod: item.FiscalPeriod || '',
                FiscalYearPeriod: item.FiscalYearPeriod || '',
                PostingDate: _parseDate(item.PostingDate),
                DocumentDate: _parseDate(item.DocumentDate),
                // Accounting context
                GLAccountType: item.GLAccountType || '',
                OffsettingAccount: item.OffsettingAccount || '',
                BusinessTransactionType: item.BusinessTransactionType || '',
                // Quantity context
                BaseUnit: item.BaseUnit || '',
                ValuationQuantity: _parseNumber(item.ValuationQuantity),
                // Document references
                ReferenceDocumentType: item.ReferenceDocumentType || '',
                SourceReferenceDocument: item.SourceReferenceDocument || '',
                // GL Context
                Ledger: item.Ledger || '',
                LedgerFiscalYear: item.LedgerFiscalYear || '',
                ChartOfAccounts: item.ChartOfAccounts || '',
                // Currency Context
                TransactionCurrency: item.TransactionCurrency || '',
                CompanyCodeCurrency: item.CompanyCodeCurrency || '',
                GlobalCurrency: item.GlobalCurrency || ''
            };
        });
}

/**
 * Map raw Journal Entry Items → MaterialCosts records
 *
 * Source API: API_JOURNALENTRYITEMBASIC_SRV / A_JournalEntryItemBasic
 *
 * Only items whose GLAccount starts with '5' or '6' (COGS) are included.
 * Journal entries MAY contain a Material field which allows direct correlation.
 *
 * Mapping:
 *   Material (when available)        → MaterialID
 *   GLAccount                        → GLAccount
 *   AmountInTransactionCurrency      → CostAmount (sign adjusted)
 *   AccountingDocument               → AccountingDocument
 *   FiscalYear                       → FiscalYear
 *
 * @param {Array} rawJournalItems - Raw API response items
 * @returns {Array} Normalized MaterialCosts records
 */
function mapJournalEntries(rawJournalItems) {
    if (!Array.isArray(rawJournalItems)) return [];

    return rawJournalItems
        .filter((item) => _isCOGSAccount(item.GLAccount))
        .map((item) => {
            const amount = _parseNumber(item.AmountInTransactionCurrency);
            const costAmount = item.DebitCreditCode === 'S' ? Math.abs(amount) : -Math.abs(amount);

            return {
                ID: uuidv4(),
                MaterialID: item.Material ? item.Material.trim() : '',
                CostAmount: costAmount,
                GLAccount: item.GLAccount || '',
                AccountingDocument: item.AccountingDocument || '',
                FiscalYear: item.FiscalYear || '',
                // New analytical dimensions
                CompanyCode: item.CompanyCode || '',
                Plant: item.Plant || '',
                ProfitCenter: item.ProfitCenter || '',
                CostCenter: item.CostCenter || '',
                Segment: item.Segment || '',
                FunctionalArea: item.FunctionalArea || '',
                // Fiscal context
                FiscalPeriod: item.FiscalPeriod || '',
                FiscalYearPeriod: item.FiscalYearPeriod || '',
                PostingDate: _parseDate(item.PostingDate),
                DocumentDate: _parseDate(item.DocumentDate),
                // Accounting context
                GLAccountType: item.GLAccountType || '',
                OffsettingAccount: item.OffsettingAccount || '',
                BusinessTransactionType: item.BusinessTransactionType || '',
                // Quantity context
                BaseUnit: item.BaseUnit || '',
                ValuationQuantity: _parseNumber(item.ValuationQuantity),
                // Document references
                ReferenceDocumentType: item.ReferenceDocumentType || '',
                SourceReferenceDocument: item.SourceReferenceDocument || '',
                // GL Context
                Ledger: item.Ledger || '',
                LedgerFiscalYear: item.LedgerFiscalYear || '',
                ChartOfAccounts: item.ChartOfAccounts || '',
                // Currency Context
                TransactionCurrency: item.TransactionCurrency || '',
                CompanyCodeCurrency: item.CompanyCodeCurrency || '',
                GlobalCurrency: item.GlobalCurrency || ''
            };
        });
}

module.exports = {
    mapBillingDocuments,
    mapGLLineItems,
    mapJournalEntries,
};
