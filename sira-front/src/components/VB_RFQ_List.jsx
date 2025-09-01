// C:\SIRA\sira-front\src\components\VB_RFQ_List.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';

const RfqSummaryModal = ({ open, onClose, rfqId }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && rfqId) {
            setLoading(true);
            api.get(`/api/rfq/${rfqId}`)
                .then(data => {
                    const resumen = {};
                    data.materiales.forEach(m => {
                        m.opciones.forEach(o => {
                            if (o.seleccionado) {
                                const prov = o.proveedor_razon_social || o.proveedor_nombre;
                                if (!resumen[prov]) resumen[prov] = [];
                                resumen[prov].push({ ...m, ...o });
                            }
                        });
                    });
                    setDetails({ rfq_code: data.rfq_code, resumen });
                })
                .catch(() => toast.error("No se pudo cargar el resumen."))
                .finally(() => setLoading(false));
        }
    }, [open, rfqId]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Resumen de Compra: <strong>{details?.rfq_code}</strong></DialogTitle>
            <DialogContent dividers>
                {loading ? <CircularProgress /> : !details ? <p>No hay datos.</p> : (
                    Object.entries(details.resumen).map(([proveedor, items]) => (
                        <div key={proveedor} className="mb-4">
                            <Typography variant="h6">{proveedor}</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Material</TableCell>
                                        <TableCell align="right">Cant.</TableCell>
                                        <TableCell align="right">Precio Unit.</TableCell>
                                        <TableCell align="right">Subtotal</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.material}</TableCell>
                                            <TableCell align="right">{item.cantidad_cotizada}</TableCell>
                                            <TableCell align="right">${Number(item.precio_unitario).toFixed(4)}</TableCell>
                                            <TableCell align="right">${(item.cantidad_cotizada * item.precio_unitario).toFixed(4)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ))
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
        </Dialog>
    );
};

export default function VB_RFQ_List({ onEdit }) {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState({ open: false, rfqId: null });

  const fetchRfqs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/rfq/por-aprobar');
      setRfqs(data);
    } catch (err) {
      toast.error(err.error || 'Error al cargar los RFQ por aprobar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRfqs();
  }, [fetchRfqs]);
  
  const handleAction = async (actionFn, successMsg) => {
    try {
        const result = await actionFn();
        toast.success(successMsg || result.mensaje);
        fetchRfqs();
    } catch (err) {
        toast.error(err.error || 'La acción falló.');
    }
  };

  const handleApprove = (id) => {
    if (window.confirm("¿Estás seguro de APROBAR este RFQ y generar las Órdenes de Compra?")) {
      handleAction(() => api.post(`/api/rfq/${id}/aprobar`), 'RFQ Aprobado y OCs generadas.');
    }
  };

  const handleReject = (id) => {
    if (window.confirm("¿Estás seguro de RECHAZAR este RFQ? Se devolverá al comprador para su corrección.")) {
      handleAction(() => api.post(`/api/rfq/${id}/rechazar`), 'RFQ devuelto a cotización.');
    }
  };

  const openInfoModal = (id) => {
    setModalInfo({ open: true, rfqId: id });
  };
  
  if (loading) return <div className="flex justify-center mt-10"><CircularProgress /></div>;

  return (
    <>
      <Paper elevation={3} sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Número RFQ</TableCell>
                <TableCell>Creador</TableCell>
                <TableCell>Proyecto</TableCell>
                <TableCell>Fecha Creación</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rfqs.length > 0 ? (
                rfqs.map(rfq => (
                  <TableRow hover key={rfq.id}>
                    <TableCell>{rfq.rfq_code}</TableCell>
                    <TableCell>{rfq.usuario_creador}</TableCell>
                    <TableCell>{rfq.proyecto}</TableCell>
                    <TableCell>{new Date(rfq.fecha_creacion).toLocaleDateString()}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Aprobar y Generar OCs"><IconButton onClick={() => handleApprove(rfq.id)} color="success"><CheckCircleIcon /></IconButton></Tooltip>
                      <Tooltip title="Rechazar (Devolver a Compras)"><IconButton onClick={() => handleReject(rfq.id)} color="warning"><DoNotDisturbIcon /></IconButton></Tooltip>
                      <Tooltip title="Ver Resumen de Compra"><IconButton onClick={() => openInfoModal(rfq.id)}><InfoIcon /></IconButton></Tooltip>
                      <Tooltip title="Editar Cotización"><IconButton onClick={() => onEdit(rfq.id)} color="primary"><EditIcon /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    No hay cotizaciones pendientes de aprobación.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <RfqSummaryModal {...modalInfo} onClose={() => setModalInfo({ open: false, rfqId: null })} />
    </>
  );
}