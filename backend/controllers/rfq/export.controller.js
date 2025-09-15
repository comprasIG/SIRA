// C:\SIRA\backend\controllers\rfq\export.controller.js
const rfqExportService = require('../../services/rfqExportService');

/**
 * @route GET /api/rfq/:id/exportar-excel
 * @description Exporta los detalles de un RFQ a un archivo Excel.
 */
const exportRfqToExcel = async (req, res) => {
    const { id: rfqId } = req.params;
    try {
        // Llama al servicio para obtener el buffer del archivo
        const buffer = await rfqExportService.generateRfqExcel(rfqId);
        const rfqCode = req.query.rfqCode || rfqId; // Opcional: pasar el código para el nombre

        // Configurar las cabeceras para forzar la descarga en el navegador
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="RFQ_${rfqCode}.xlsx"`);

        // Enviar el buffer como respuesta
        res.send(buffer);

    } catch (error) {
        console.error(`Fallo en el endpoint de exportación para RFQ ${rfqId}:`, error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    exportRfqToExcel,
};