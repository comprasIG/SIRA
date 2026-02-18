/**
 * Construye las condiciones SQL para una búsqueda multi-término.
 * 
 * @param {string} query - El string de búsqueda.
 * @param {string} skuField - El nombre del campo SKU en la base de datos (default: 'sku').
 * @param {string} nameField - El nombre del campo nombre en la base de datos (default: 'nombre').
 * @param {number} startIndex - El índice inicial para los parámetros SQL ($1, $2, etc.).
 * @returns {object} - { whereClause, values }
 */
const buildSearchConditions = (query, skuField = 'sku', nameField = 'nombre', startIndex = 1) => {
    const trimmedQuery = query ? query.trim() : '';

    if (!trimmedQuery) {
        return { whereClause: '', values: [] };
    }

    // Dividir por espacios y filtrar vacíos
    const terms = trimmedQuery.split(/\s+/).filter(term => term.length > 0);

    if (terms.length === 0) {
        return { whereClause: '', values: [] };
    }

    let whereClause = '';
    const values = [];

    terms.forEach((term, index) => {
        const paramIndex = startIndex + index;
        // Construimos: AND (sku ILIKE $i OR unaccent(nombre) ILIKE unaccent($i))
        // Nota: Si es el primer término, no agregamos AND al principio si vamos a usarlo en una lista de condiciones,
        // pero aquí asumimos que se llamará así: WHERE activo=true ${whereClause}
        // Por lo tanto, SIEMPRE agregaremos AND para facilitar la concatenación con otras condiciones fijas (como activo=true).

        whereClause += ` AND (${skuField} ILIKE $${paramIndex} OR unaccent(${nameField}) ILIKE unaccent($${paramIndex}))`;
        values.push(`%${term}%`);
    });

    return { whereClause, values };
};

module.exports = {
    buildSearchConditions
};
