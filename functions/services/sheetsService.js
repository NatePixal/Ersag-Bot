const { google } = require('googleapis');
const { db } = require('../config/db');

async function syncProductsFromSheets(spreadsheetId) {
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Column Mapping: A:Name(UZ), B:Name(RU), C:Price, D:Code, E:Desc(UZ), 
    // F:Desc(RU), G:Usage(UZ), H:Usage(RU), I:ImageURL, J:Category
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Katalog!A2:J', 
    });

    const rows = response.data.values;
    if (!rows) return 0;

    const batch = db.batch();
    rows.forEach((row, i) => {
        if (!row[0]) return; 
        
        const docRef = db.collection('knowledge_base').doc(`prod_${i}`);
        batch.set(docRef, {
            name_uz:  row[0] || "",
            name_ru:  row[1] || "",
            price:    row[2] || "0",
            code:     row[3] || "",
            desc_uz:  row[4] || "",
            desc_ru:  row[5] || "",
            usage_uz: row[6] || "",
            usage_ru: row[7] || "",
            image:    row[8] || "", // Matches HTML p.image
            category: row[9] || "Boshqa",
            updatedAt: new Date()
        });
    });

    await batch.commit();
    return rows.length;
}

module.exports = { syncProductsFromSheets };