const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Google Sheets Service
 * Fetches product catalog and Doctor knowledge base from Google Sheets.
 * 
 * Sheet structure expected:
 * Tab "Katalog": code | name | price | category | description | image_url
 * Tab "Doctor_Baza": symptom | product_codes | howToUse | note
 * 
 * Set GOOGLE_SHEETS_ID and GOOGLE_API_KEY in Firebase secrets.
 */

const SHEET_ID = env.GOOGLE_SHEETS_ID;
const API_KEY = env.GOOGLE_API_KEY;

// In-memory cache to avoid hitting Sheets on every request
const cache = {
    catalog: null,
    catalogFetchedAt: null,
    doctorBaza: null,
    doctorFetchedAt: null,
};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const isCacheFresh = (fetchedAt) => {
    return fetchedAt && (Date.now() - fetchedAt) < CACHE_TTL_MS;
};

/**
 * Fetch product catalog from "Katalog" tab.
 * Returns array of product objects.
 */
const getCatalog = async () => {
    if (isCacheFresh(cache.catalogFetchedAt) && cache.catalog) {
        logger.info('[Sheets] Returning cached catalog');
        return cache.catalog;
    }
    
    if (!SHEET_ID || !API_KEY) {
        logger.warn('[Sheets] GOOGLE_SHEETS_ID or GOOGLE_API_KEY not set. Using fallback catalog.');
        return null; // Caller falls back to hardcoded products
    }
    
    try {
        const range = 'Katalog!A2:F200';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
        
        const data = await res.json();
        const rows = data.values || [];
        
        const products = rows
            .filter(row => row[0] && row[1]) // must have code and name
            .map(row => ({
                code:        row[0]?.trim() || '',
                name:        row[1]?.trim() || '',
                price:       row[2]?.trim() || '',
                category:    row[3]?.trim() || '',
                description: row[4]?.trim() || '',
                image_url:   row[5]?.trim() || '',
            }));
        
        cache.catalog = products;
        cache.catalogFetchedAt = Date.now();
        logger.info(`[Sheets] Fetched ${products.length} products from Katalog tab`);
        return products;
    } catch (err) {
        logger.error('[Sheets] Failed to fetch catalog:', err.message);
        return null;
    }
};

/**
 * Fetch Doctor knowledge base from "Doctor_Baza" tab.
 * Returns array of { symptom, product_codes, howToUse, note }
 */
const getDoctorBaza = async () => {
    if (isCacheFresh(cache.doctorFetchedAt) && cache.doctorBaza) {
        logger.info('[Sheets] Returning cached Doctor_Baza');
        return cache.doctorBaza;
    }
    
    if (!SHEET_ID || !API_KEY) {
        logger.warn('[Sheets] GOOGLE_SHEETS_ID or GOOGLE_API_KEY not set. Doctor Baza unavailable.');
        return null;
    }
    
    try {
        const range = 'Doctor_Baza!A2:D100';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
        
        const data = await res.json();
        const rows = data.values || [];
        
        const baza = rows
            .filter(row => row[0])
            .map(row => ({
                symptom:      row[0]?.trim() || '',
                product_codes: (row[1] || '').split(',').map(c => c.trim()),
                howToUse:     row[2]?.trim() || '',
                note:         row[3]?.trim() || '',
            }));
        
        cache.doctorBaza = baza;
        cache.doctorFetchedAt = Date.now();
        logger.info(`[Sheets] Fetched ${baza.length} entries from Doctor_Baza tab`);
        return baza;
    } catch (err) {
        logger.error('[Sheets] Failed to fetch Doctor_Baza:', err.message);
        return null;
    }
};

/**
 * Lookup a single product by code from Sheets (or fallback to local).
 */
const getProductByCode = async (code) => {
    const catalog = await getCatalog();
    if (!catalog) return null;
    return catalog.find(p => p.code.toUpperCase() === code.toUpperCase()) || null;
};

/**
 * Force-clear cache (call from admin endpoint if needed).
 */
const clearCache = () => {
    cache.catalog = null;
    cache.catalogFetchedAt = null;
    cache.doctorBaza = null;
    cache.doctorFetchedAt = null;
    logger.info('[Sheets] Cache cleared');
};

module.exports = { getCatalog, getDoctorBaza, getProductByCode, clearCache };
