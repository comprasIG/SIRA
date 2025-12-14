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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { RFQ_STATUS_COLOR, OC_STATUS_COLOR } from './statusColors';
import api from '../../api/api'; // ✅ usa tu helper con token + VITE_API_URL

/**
 * Tabla que muestra las requisiciones (RFQs) y las órdenes de compra asociadas.
 *
 * @param {Object} props
 * @param {Array} props.rfqs - Lista de requisiciones agrupadas con sus OCs.
 */
export default function RfqTable({ rfqs }) {
  const [selectedOc, setSelectedOc] = useState(null);
  const [ocDetail, setOcDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleOcClick = async (numeroOc) => {
    setSelectedOc(numeroOc);
    setLoadingDetail(true);
    try {
      // ✅ aquí estaba el bug: fetch directo devolvía HTML si no pegaba al backend
      const data = await api.get(`/api/dashboard/oc/${numeroOc}`);
      setOcDetail(data?.ordenCompra || null);
    } catch (err) {
      console.error(err);
      setOcDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleClose = () => {
    setSelectedOc(null);
    setOcDetail(null);
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
                            onClick={() => handleOcClick(oc.numero_oc)}
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
      <Dialog open={Boolean(selectedOc)} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Detalle de Orden de Compra</DialogTitle>
        <DialogContent dividers>
          {loadingDetail ? (
            <Typography>Cargando...</Typography>
          ) : ocDetail ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Número OC: {ocDetail.numero_oc}
              </Typography>
              <Typography variant="body2">Status: {ocDetail.status}</Typography>
              <Typography variant="body2">Proveedor: {ocDetail.proveedor_nombre}</Typography>
              <Typography variant="body2">Proyecto: {ocDetail.proyecto_nombre}</Typography>
              <Typography variant="body2">Sitio: {ocDetail.sitio_nombre}</Typography>
              <Typography variant="body2">Usuario: {ocDetail.usuario_nombre}</Typography>
              <Typography variant="body2">
                Fecha creación: {new Date(ocDetail.fecha_creacion).toLocaleDateString()}
              </Typography>

              <Typography variant="body2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                Ítems:
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell>Cantidad</TableCell>
                    <TableCell>Precio unitario</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Recibido</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(ocDetail.items || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.material_nombre}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>{item.cantidad}</TableCell>
                      <TableCell>{item.precio_unitario}</TableCell>
                      <TableCell>{item.total}</TableCell>
                      <TableCell>{item.cantidad_recibida}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography>No se encontró información.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
