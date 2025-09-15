//C:\SIRA\backend\services\rfqExportService.js

const pool = require('../db/pool');
const ExcelJS = require('exceljs');

/**
 * @description Genera un buffer de un archivo Excel con los detalles de un RFQ.
 * @param {number} rfqId - El ID del RFQ a exportar.
 * @returns {Promise<Buffer>} Buffer del archivo .xlsx generado.
 */
const generateRfqExcel = async (rfqId) => {
    const client = await pool.connect();
    try {
        // Consulta que trae los detalles de la requisición (materiales, cantidades, etc.)
        const query = `
            SELECT
                rd.id as item_id,
                cm.nombre as material,
                rd.cantidad as cantidad_requerida,
                cu.simbolo as unidad,
                rd.comentario
            FROM requisiciones_detalle rd
            JOIN catalogo_materiales cm ON rd.material_id = cm.id
            JOIN catalogo_unidades cu ON cm.unidad_de_compra = cu.id
            WHERE rd.requisicion_id = $1
            ORDER BY cm.nombre ASC;
        `;
        const result = await client.query(query, [rfqId]);
        const items = result.rows;

        // Crear el libro y la hoja de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Detalle de RFQ');

        // Definir las columnas
        worksheet.columns = [
            { header: 'ID Item', key: 'item_id', width: 10 },
            { header: 'Material', key: 'material', width: 50 },
            { header: 'Cantidad Requerida', key: 'cantidad_requerida', width: 20 },
            { header: 'Unidad', key: 'unidad', width: 10 },
            { header: 'Comentario', key: 'comentario', width: 50 },
        ];

        // Agregar los datos de la base de datos a la hoja
        worksheet.addRows(items);

        // Convertir el libro de Excel a un buffer para enviarlo al frontend
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;

    } catch (error) {
        console.error(`Error al generar el Excel para el RFQ ${rfqId}:`, error);
        throw new Error('No se pudo generar el archivo Excel.');
    } finally {
        client.release();
    }
};

module.exports = {
    generateRfqExcel,
};