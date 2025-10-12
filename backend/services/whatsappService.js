// backend/services/whatsappService.js

/**
 * Simula el envío de un mensaje de WhatsApp para una OC.
 * En el futuro, aquí se integrará la API real de WhatsApp.
 * @param {string} recipient - Número de teléfono del destinatario.
 * @param {string} message - Mensaje a enviar.
 * @returns {Promise<object>} - Promesa que resuelve con un objeto de éxito simulado.
 */
const sendWhatsAppMessage = async (recipient, message) => {
  console.log('============================================');
  console.log('--- SIMULACIÓN DE ENVÍO DE WHATSAPP ---');
  console.log(`Destinatario: ${recipient}`);
  console.log(`Mensaje: ${message}`);
  console.log('============================================');

  // Simula una llamada a una API externa
  await new Promise(resolve => setTimeout(resolve, 500));

  if (!recipient || !message) {
    throw new Error('Destinatario y mensaje son requeridos para WhatsApp.');
  }

  return {
    success: true,
    messageId: `simulated_${Date.now()}`,
    status: 'sent_simulated',
  };
};

module.exports = {
  sendWhatsAppMessage,
};