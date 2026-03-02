/**
 * Objetivo (Prompt #2):
 * - Permitir que cualquier usuario cree solicitudes de efectivo/viáticos hacia Finanzas desde dashboard,
 *   seleccionando sitio/proyecto destino y 1..n empleados viajeros (desde public.empleados).
 *
 * Diseño:
 * - public.fin_solicitudes_viaticos: encabezado (tipo, monto, días, hospedaje/transporte, status)
 * - public.fin_solicitudes_viaticos_empleados: relación N:M (solicitud <-> empleados)
 */

exports.shorthands = undefined;


const { grant_block } = require('./_helpers/grants');
exports.up = (pgm) => {
  pgm.createTable('fin_solicitudes_viaticos', {
    id: 'id',

    tipo_solicitud: { type: 'varchar(20)', notNull: true }, // EFECTIVO | VIATICOS
    status: { type: 'varchar(20)', notNull: true, default: 'PENDIENTE' }, // BORRADOR/ENVIADA/APROBADA/PAGADA/RECHAZADA

    solicitante_usuario_id: { type: 'integer', notNull: true, references: 'usuarios(id)', onDelete: 'RESTRICT' },

    sitio_destino_id: { type: 'integer', notNull: false, references: 'sitios(id)', onDelete: 'SET NULL' },
    proyecto_destino_id: { type: 'integer', notNull: false, references: 'proyectos(id)', onDelete: 'SET NULL' },

    monto_solicitado: { type: 'numeric(14,2)', notNull: true },
    moneda: { type: 'bpchar(3)', notNull: true, default: 'MXN', references: 'catalogo_monedas(codigo)', onDelete: 'RESTRICT' },

    dias_viaje: { type: 'integer', notNull: false },

    // Hospedaje (opcional)
    hospedaje_requerido: { type: 'boolean', notNull: true, default: false },
    hospedaje_noches: { type: 'integer', notNull: false },
    hospedaje_fecha_inicio: { type: 'date', notNull: false },
    hospedaje_fecha_fin: { type: 'date', notNull: false },

    // Transporte (opcional)
    transporte_requerido: { type: 'boolean', notNull: true, default: false },
    transporte_fecha_salida: { type: 'date', notNull: false },
    transporte_fecha_regreso: { type: 'date', notNull: false },
    transporte_origen: { type: 'varchar(200)', notNull: false },
    transporte_destino: { type: 'varchar(200)', notNull: false },

    comentario: { type: 'text', notNull: false },

    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Checks y reglas mínimas
  pgm.addConstraint('fin_solicitudes_viaticos', 'chk_fin_sol_viat_tipo', {
    check: "tipo_solicitud IN ('EFECTIVO','VIATICOS')",
  });
  pgm.addConstraint('fin_solicitudes_viaticos', 'chk_fin_sol_viat_status', {
    check: "status IN ('BORRADOR','PENDIENTE','ENVIADA','APROBADA','PAGADA','RECHAZADA','CANCELADA')",
  });
  pgm.addConstraint('fin_solicitudes_viaticos', 'chk_fin_sol_viat_monto_pos', {
    check: 'monto_solicitado > 0',
  });
  pgm.addConstraint('fin_solicitudes_viaticos', 'chk_fin_sol_viat_dias_nonneg', {
    check: '(dias_viaje IS NULL) OR (dias_viaje >= 0)',
  });

  pgm.createIndex('fin_solicitudes_viaticos', 'solicitante_usuario_id');
  pgm.createIndex('fin_solicitudes_viaticos', 'status');
  pgm.sql(`CREATE INDEX idx_fin_solicitudes_viaticos_creado_en_desc ON public.fin_solicitudes_viaticos (creado_en DESC);`);

  pgm.sql(`
    CREATE TRIGGER trg_fin_solicitudes_viaticos_update
    BEFORE UPDATE ON public.fin_solicitudes_viaticos
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  `);

  // Relación solicitud <-> empleados viajeros
  pgm.createTable('fin_solicitudes_viaticos_empleados', {
    solicitud_id: { type: 'integer', notNull: true, references: 'fin_solicitudes_viaticos(id)', onDelete: 'CASCADE' },
    empleado_id: { type: 'integer', notNull: true, references: 'empleados(id)', onDelete: 'RESTRICT' },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('fin_solicitudes_viaticos_empleados', 'pk_fin_solicitudes_viaticos_empleados', {
    primaryKey: ['solicitud_id', 'empleado_id'],
  });

  pgm.createIndex('fin_solicitudes_viaticos_empleados', 'empleado_id');
  pgm.createIndex('fin_solicitudes_viaticos_empleados', 'solicitud_id');

  // Permisos
  pgm.sql(grant_block({ tables: ["fin_solicitudes_viaticos","fin_solicitudes_viaticos_empleados"], sequences: ["fin_solicitudes_viaticos_id_seq"] }));
};

exports.down = (pgm) => {
  pgm.dropTable('fin_solicitudes_viaticos_empleados');

  pgm.sql(`DROP TRIGGER IF EXISTS trg_fin_solicitudes_viaticos_update ON public.fin_solicitudes_viaticos;`);
  pgm.dropTable('fin_solicitudes_viaticos');
};
