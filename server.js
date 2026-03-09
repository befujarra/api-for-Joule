// =============================================================================
// Custom CDS Server
// =============================================================================
// Custom server entry point that boots CDS without requiring a database
// connection. Since all entities use @cds.persistence.skip, no DB is needed.
// =============================================================================

const cds = require('@sap/cds');

// Load .env file if present
try { require('dotenv').config(); } catch (e) { /* dotenv is optional */ }

module.exports = cds.server;
