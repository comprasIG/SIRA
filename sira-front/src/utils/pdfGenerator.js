import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '/logo.png';

/**
 * Genera un PDF de Requisición con un diseño profesional y detallado.
 * @param {object} requisicion - El objeto con los datos completos de la requisicion.
 * @param {string} approverName - El nombre del gerente que aprueba.
 */
export const generateRequisitionPdf = (requisicion, approverName) => {
  const doc = new jsPDF();

  // --- 1. CONSTANTES DE DISEÑO ---
  const brandColor = [22, 160, 133];
  const lightGrayColor = [240, 240, 240];
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const startYOffset = 10;

  // --- 2. ENCABEZADO ---
  const logoWidth = 35;
  const logoHeight = 35 * (doc.getImageProperties(logo).height / doc.getImageProperties(logo).width);
  doc.addImage(logo, 'PNG', margin, startYOffset, logoWidth, logoHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('REQUISICIÓN DE MATERIALES', pageWidth / 2, startYOffset + 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Número Req: ${requisicion.numero_requisicion}`, pageWidth - margin, startYOffset + 5, { align: 'right' });
  doc.text(`Fecha de Aprobación: ${new Date().toLocaleDateString()}`, pageWidth - margin, startYOffset + 10, { align: 'right' });
  
  doc.setDrawColor(...brandColor);
  doc.setLineWidth(0.5);
  doc.line(margin, startYOffset + logoHeight + 5, pageWidth - margin, startYOffset + logoHeight + 5);
  
  let currentY = startYOffset + logoHeight + 15;

  // --- 3. SECCIÓN DE INFORMACIÓN GENERAL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...brandColor);
  doc.text('Información General', margin, currentY);

  doc.setFillColor(...lightGrayColor);
  doc.rect(margin, currentY + 4, pageWidth - (margin * 2), 30, 'F');

  const col1LabelX = margin + 5;
  const col1ValueX = col1LabelX + 35;
  const col2LabelX = pageWidth / 2 + 10;
  const col2ValueX = col2LabelX + 35;
  const initialYInfo = currentY + 11;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Solicitante:', col1LabelX, initialYInfo);
  doc.text('Departamento:', col1LabelX, initialYInfo + 7);
  doc.text('Proyecto:', col1LabelX, initialYInfo + 14);

  doc.text('Aprobado por:', col2LabelX, initialYInfo);
  doc.text('Fecha Req:', col2LabelX, initialYInfo + 7);
  doc.text('Lugar Entrega:', col2LabelX, initialYInfo + 14);

  const departamentoSolicitante = requisicion.numero_requisicion.split('_')[0];

  doc.setFont('helvetica', 'normal');
  doc.text(requisicion.usuario_creador, col1ValueX, initialYInfo);
  doc.text(departamentoSolicitante || 'N/A', col1ValueX, initialYInfo + 7);
  doc.text(requisicion.proyecto, col1ValueX, initialYInfo + 14);

  doc.text(approverName, col2ValueX, initialYInfo);
  doc.text(new Date(requisicion.fecha_requerida).toLocaleDateString(), col2ValueX, initialYInfo + 7);
  doc.text(requisicion.lugar_entrega, col2ValueX, initialYInfo + 14);

  currentY = initialYInfo + 25;

  // --- 4. TABLA DE MATERIALES ---
  const tableColumn = ["Material", "Cantidad", "Unidad", "Comentario"];
  const tableRows = requisicion.materiales.map(mat => [
    mat.material,
    mat.cantidad,
    mat.unidad,
    mat.comentario || 'N/A'
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: currentY,
    theme: 'grid',
    headStyles: {
      fillColor: brandColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: lightGrayColor
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY;

  // --- 5. COMENTARIO GENERAL (si existe) ---
  if (requisicion.comentario_general && requisicion.comentario_general.trim() !== '') {
    currentY += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Comentario General:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    const commentLines = doc.splitTextToSize(requisicion.comentario_general, pageWidth - (margin * 2));
    doc.text(commentLines, margin, currentY + 6);
    const commentHeight = doc.getTextDimensions(commentLines).h;
    currentY += commentHeight + 6;
  }

  // --- 6. ARCHIVOS ADJUNTOS (si existen) ---
  if (requisicion.adjuntos && requisicion.adjuntos.length > 0) {
    currentY += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Archivos Adjuntos:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    requisicion.adjuntos.forEach((file, index) => {
        doc.text(`- ${file.nombre_archivo}`, margin + 5, currentY + 6 + (index * 5));
    });
  }

  // --- 7. PIE DE PÁGINA ---
  const pageHeight = doc.internal.pageSize.getHeight();
  let footerCurrentY = pageHeight - 30;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, footerCurrentY, pageWidth - margin, footerCurrentY);
  footerCurrentY += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);

  const textWidth = pageWidth - (margin * 2);

  const footerLine1 = 'Este documento contiene información confidencial y es propiedad de Grupo IG.';
  const footerLine2 = 'Su uso y distribución están restringidos. Para dudas o seguimiento, contacte al equipo de Compras.';
  const footerLine3 = 'Documento generado automáticamente por el Sistema Integral de Requisiciones y Abastecimiento de Grupo IG - SIRA PROJECT';

  doc.text(footerLine1, pageWidth / 2, footerCurrentY, { align: 'center', maxWidth: textWidth });
  footerCurrentY += 4;

  doc.text(footerLine2, pageWidth / 2, footerCurrentY, { align: 'center', maxWidth: textWidth });
  footerCurrentY += 4;

  doc.text(footerLine3, pageWidth / 2, footerCurrentY, { align: 'center', maxWidth: textWidth });

  doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: 'right' });

  // --- 8. GUARDAR EL DOCUMENTO ---
  doc.save(`Requisicion_${requisicion.numero_requisicion}.pdf`);
};