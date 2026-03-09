// =============================================================================
// SAP S/4HANA Cloud API Clients
// =============================================================================
// Handles communication with three SAP S/4HANA Cloud Sandbox APIs:
//   1. Billing Documents (API_BILLING_DOCUMENT_SRV)
//   2. GL Account Line Items (API_GLACCOUNTLINEITEM)
//   3. Journal Entry Items (API_JOURNALENTRYITEMBASIC_SRV)
//
// Features:
//   - OData pagination support ($skip / $top)
//   - In-memory caching with TTL
//   - Parallel execution via Promise.all
//   - Comprehensive error handling
// =============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URLS = {
    billing:
        'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV',
    glAccount:
        'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_GLACCOUNTLINEITEM',
    journalEntry:
        'https://my409101-api.s4hana.cloud.sap/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV',
};

// OData pagination settings
const PAGE_SIZE = 100;

// In-memory cache (TTL in milliseconds — default 5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

// ---------------------------------------------------------------------------
// Helper: Build common Axios request config
// ---------------------------------------------------------------------------
function _buildConfig() {
    const config = {
        headers: {
            Accept: 'application/json',
        },
        timeout: 30000, // 30 seconds
    };

    // Configurando Basic Auth a partir das variáveis de ambiente
    if (process.env.SAP_USERNAME && process.env.SAP_PASSWORD) {
        config.auth = {
            username: process.env.SAP_USERNAME.trim(),
            password: process.env.SAP_PASSWORD.trim()
        };
    }

    return config;
}

// ---------------------------------------------------------------------------
// Helper: Read from cache
// ---------------------------------------------------------------------------
function _getFromCache(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        console.log(`[Cache HIT] ${key}`);
        return entry.data;
    }
    cache.delete(key);
    return null;
}

// ---------------------------------------------------------------------------
// Helper: Write to cache
// ---------------------------------------------------------------------------
function _setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Helper: Paginated OData fetch
// Iterates through all pages using $skip/$top until no more results.
// ---------------------------------------------------------------------------
async function _fetchAllPages(baseUrl, entitySet, selectFields) {
    const cacheKey = `${entitySet}`;
    const cached = _getFromCache(cacheKey);
    if (cached) return cached;

    const allResults = [];
    let skip = 0;
    let hasMore = true;

    console.log(`[API] Fetching ${entitySet} from ${baseUrl}...`);

    while (hasMore) {
        const selectParam = selectFields ? `&$select=${selectFields}` : '';
        const url = `${baseUrl}/${entitySet}?$format=json&$top=${PAGE_SIZE}&$skip=${skip}${selectParam}`;
        try {
            const response = await axios.get(url, _buildConfig());
            const results = response.data.d?.results || response.data.value || [];

            allResults.push(...results);

            // If we got fewer results than PAGE_SIZE, we've reached the end
            if (results.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                skip += PAGE_SIZE;
            }

            console.log(`[API] ${entitySet}: fetched ${allResults.length} records so far`);
        } catch (error) {
            console.error(`[API Error] ${entitySet} at skip=${skip}:`, error.message);
            // On error, stop pagination but return what we have
            hasMore = false;
        }
    }

    console.log(`[API] ${entitySet}: total ${allResults.length} records fetched`);
    _setCache(cacheKey, allResults);
    return allResults;
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Fetch Billing Documents from API_BILLING_DOCUMENT_SRV
 *
 * Extracts: BillingDocument, BillingDocumentItem, Material,
 *           BillingQuantity, NetAmount, TransactionCurrency, BillingDocumentDate
 *
 * @returns {Promise<Array>} Raw billing document items
 */
async function fetchBillingDocuments() {
    const selectFields = [
        'BillingDocument',
        'BillingDocumentItem',
        'Material',
        'BillingQuantity',
        'NetAmount',
        'TransactionCurrency'
    ].join(',');

    return _fetchAllPages(
        BASE_URLS.billing,
        'A_BillingDocumentItem',
        selectFields
    );
}

/**
 * Fetch GL Account Line Items from API_GLACCOUNTLINEITEM
 *
 * Extracts: CompanyCode, GLAccount, AmountInCompanyCodeCurrency,
 *           DebitCreditCode, AccountingDocument, FiscalYear
 *
 * @returns {Promise<Array>} Raw GL account line items
 */
async function fetchGLAccountLineItems() {
    // HACK: The Sandbox SAP API for GLAccountLineItem returns different mock data permutations
    // depending on the $select param, hiding COGS (5/6) accounts and failing at skip=400.
    // Fetching without $select retrieves a better slice of mock data that includes costs.
    return _fetchAllPages(
        BASE_URLS.glAccount,
        'GLAccountLineItem',
        '' // No $select
    );
}

/**
 * Fetch Journal Entry Items from API_JOURNALENTRYITEMBASIC_SRV
 *
 * Extracts: CompanyCode, AccountingDocument, FiscalYear, GLAccount,
 *           AmountInTransactionCurrency, DebitCreditCode, Material
 *
 * @returns {Promise<Array>} Raw journal entry items
 */
async function fetchJournalEntryItems() {
    const selectFields = [
        'CompanyCode',
        'AccountingDocument',
        'FiscalYear',
        'GLAccount',
        'AmountInTransactionCurrency',
        'DebitCreditCode',
        'Material',
    ].join(',');

    return _fetchAllPages(
        BASE_URLS.journalEntry,
        'JournalEntryItemBasic',
        selectFields
    );
}

/**
 * Fetch ALL data from the three APIs in parallel.
 * This is the primary entry point used by the service handler.
 *
 * @returns {Promise<{billing: Array, glItems: Array, journalEntries: Array}>}
 */
async function fetchAllData() {
    console.log('[API] Starting parallel fetch of all SAP APIs...');

    const [billing, glItems, journalEntries] = await Promise.all([
        fetchBillingDocuments(),
        fetchGLAccountLineItems(),
        fetchJournalEntryItems(),
    ]);

    console.log(
        `[API] Parallel fetch complete. Billing: ${billing.length}, GL: ${glItems.length}, Journal: ${journalEntries.length}`
    );

    return { billing, glItems, journalEntries };
}

/**
 * Clear the in-memory cache (useful for testing or forced refresh).
 */
function clearCache() {
    cache.clear();
    console.log('[Cache] Cleared');
}

module.exports = {
    fetchBillingDocuments,
    fetchGLAccountLineItems,
    fetchJournalEntryItems,
    fetchAllData,
    clearCache,
};
