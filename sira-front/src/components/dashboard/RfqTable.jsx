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
  Select,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import { RFQ_STATUS_COLOR, OC_STATUS_COLOR } from './statusColors';
import RfqCodeChip from '../common/RfqCodeChip';
import api from '../../api/api';
import { useOcPreview } from '../../hooks/useOcPreview';
import OCInfoModal from '../common/OCInfoModal';
import { useRfqPreview } from '../../hooks/useRfqPreview';
import RFQInfoModal from '../common/RFQInfoModal';

/**
 * Tabla que muestra las requisiciones (RFQs) y las órdenes de compra asociadas.
 *
 * @param {Object} props
 * @param {Array}    props.rfqs              - Lista de requisiciones agrupadas con sus OCs.
 * @param {string}   props.mode              - Modo del dashboard ('SSD', etc.)
 * @param {string[]} props.rfqStatusOptions  - Enum de statuses válidos del backend
 * @param {Function} props.onStatusChanged   - Callback para recargar datos tras cambio
 */
export default function RfqTable({ rfqs, mode, rfqStatusOptions = [], onStatusChanged }) {
  const {
    previewOpen, previewOc, previewItems, previewMetadata, loading: previewLoading,
    openPreview, closePreview
  } = useOcPreview();

  const {
    previewOpen: rfqOpen,
    previewRfq,
    previewItems: rfqItems,
    previewMetadata: rfqMetadata,
    previewAttachments: rfqAttachments,
    loading: rfqLoading,
    openPreview: openRfqPreview,
    closePreview: closeRfqPreview
  } = useRfqPreview();

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  // Track which row is updating
  const [updatingId, setUpdatingId] = useState(null);

  const isSSD = mode === 'SSD';

  const handleStatusChange = async (rfqId, newStatus) => {
    setUpdatingId(rfqId);
    try {
      await api.patch(`/api/dashboard/requisicion/${rfqId}/status`, { status: newStatus });
      setSnackbar({ open: true, message: `Status actualizado a '${newStatus}'`, severity: 'success' });
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setSnackbar({ open: true, message: err?.error || 'Error al actualizar status', severity: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

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
                <TableCell>
                  <RfqCodeChip
                    label={rfq.rfq_code}
                    onClick={() => openRfqPreview(rfq)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {rfq.sitio}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rfq.proyecto}
                  </Typography>
                </TableCell>
                <TableCell>
                  {isSSD && rfqStatusOptions.length > 0 ? (
                    <Select
                      size="small"
                      value={rfq.rfq_status}
                      onChange={(e) => handleStatusChange(rfq.rfq_id, e.target.value)}
                      disabled={updatingId === rfq.rfq_id}
                      variant="standard"
                      disableUnderline
                      IconComponent={(props) => (
                        <span {...props} style={{ ...props.style, fontSize: 14, color: '#999', marginLeft: -4 }}>▾</span>
                      )}
                      renderValue={(value) => (
                        <Chip
                          label={value}
                          color={RFQ_STATUS_COLOR[value] || 'default'}
                          size="small"
                          sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                        />
                      )}
                      sx={{
                        '& .MuiSelect-select': {
                          p: '0 !important',
                          pr: '16px !important',
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInput-input:focus': { backgroundColor: 'transparent' },
                      }}
                    >
                      {rfqStatusOptions.map((s) => (
                        <MenuItem key={s} value={s}>
                          <Chip
                            label={s}
                            color={RFQ_STATUS_COLOR[s] || 'default'}
                            size="small"
                            sx={{ fontWeight: 'bold', pointerEvents: 'none' }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  ) : (
                    <Chip
                      label={rfq.rfq_status}
                      color={RFQ_STATUS_COLOR[rfq.rfq_status] || 'default'}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  )}
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

      {/* Modal para mostrar el detalle del RFQ seleccionado */}
      {previewRfq && (
        <RFQInfoModal
          open={rfqOpen}
          onClose={closeRfqPreview}
          rfq={previewRfq}
          items={rfqItems}
          metadata={rfqMetadata}
          attachments={rfqAttachments}
          loading={rfqLoading}
        />
      )}

      {/* Snackbar de confirmación */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
