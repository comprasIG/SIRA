-- Permitir OCs directas sin RFQ asociado
ALTER TABLE ordenes_compra ALTER COLUMN rfq_id DROP NOT NULL;
