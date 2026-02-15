import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';
import { RFQ_STATUS_COLOR, OC_STATUS_COLOR } from './statusColors';
import api from '../../api/api'; // ✅ usa tu helper con token + VITE_API_URL
import { useOcPreview } from '../../hooks/useOcPreview'; // <<< Hook compartido
import OCInfoModal from '../common/OCInfoModal'; // <<< Modal compartido

/**
 * Tabla que muestra las requisiciones (RFQs) y las órdenes de compra asociadas.
 *
 * @param {Object} props
 * @param {Array} props.rfqs - Lista de requisiciones agrupadas con sus OCs.
 */
export default function RfqTable({ rfqs }) {
  const {
    previewOpen, previewOc, previewItems, previewMetadata, loading: previewLoading,
    openPreview, closePreview
  } = useOcPreview();

  return (
    <>
      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Num RFQ</TableCell>
              <TableCell>Sitio y Proyecto</TableCell>
              <TableCell>Status RFQ</TableCell>
              <TableCell>Órdenes de Compra</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rfqs || []).map((rfq) => (
              <TableRow key={rfq.rfq_id} hover>
                <TableCell sx={{ fontWeight: 'bold' }}>{rfq.rfq_code}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {rfq.sitio}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rfq.proyecto}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={rfq.rfq_status}
                    color={RFQ_STATUS_COLOR[rfq.rfq_status] || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {(rfq.ordenes || []).length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {rfq.ordenes.map((oc) => (
                        <Tooltip key={oc.numero_oc} title={`Status: ${oc.oc_status}`}>
                          <Chip
                            label={oc.numero_oc}
                            color={OC_STATUS_COLOR[oc.oc_status] || 'default'}
                            size="small"
                            variant="outlined"
                            onClick={() => openPreview(oc)}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Sin OCs generadas
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal para mostrar el detalle de la OC seleccionada */}
      {previewOc && (
        <OCInfoModal
          open={previewOpen}
          onClose={closePreview}
          oc={previewOc}
          items={previewItems}
          metadata={previewMetadata}
          loading={previewLoading}
        />
      )}
    </>
  );
}
