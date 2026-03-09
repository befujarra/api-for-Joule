// =============================================================================
// Custom CDS Server for Vercel Serverless Function
// =============================================================================

const cds = require('@sap/cds');
const express = require('express');

try { require('dotenv').config(); } catch (e) { /* dotenv is optional */ }

const app = express();

let initPromise;

module.exports = async (req, res) => {
    if (!initPromise) {
        initPromise = cds.serve('all').in(app);
    }
    await initPromise;
    return app(req, res);
};
