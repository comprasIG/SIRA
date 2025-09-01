// C:\SIRA\sira-front\src\components\G_RFQ_List.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Button, CircularProgress, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Typography
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoIcon from '@mui/icons-material/Info';
import CancelIcon from '@mui/icons-material/Cancel';

// Modal de Información Mejorado
const InfoModal = ({ open, onClose, rfqId }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && rfqId) {
            setLoading(true);
            api.get(`/api/rfq/${rfqId}`)
                .then(data => setDetails(data))
                .catch(() => toast.error("No se pudo cargar el detalle."))
                .finally(() => setLoading(false));
        }
    }, [open, rfqId]);

    if (!details) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Detalle RFQ: <strong>{details.rfq_code}</strong></DialogTitle>
            <DialogContent dividers>
                {loading ? <CircularProgress /> : (
                    <>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <p><strong>Proyecto:</strong> {details.proyecto}</p>
                            <p><strong>Sitio:</strong> {details.sitio}</p>
                            <p><strong>Creador:</strong> {details.usuario_creador}</p>
                            <p><strong>Se entrega en:</strong> {details.lugar_entrega}</p>
                            {details.comentario_general && (
                                <p className="col-span-2"><strong>Comentario General:</strong> {details.comentario_general}</p>
                            )}
                        </div>
                        <h4 className="font-semibold text-lg mb-2">Materiales Solicitados:</h4>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Material</TableCell>
                                        <TableCell align="right">Cantidad</TableCell>
                                        <TableCell>Unidad</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {details.materiales?.map(mat => (
                                        <TableRow key={mat.id}>
                                            <TableCell>{mat.material}</TableCell>
                                            <TableCell align="right">{mat.cantidad}</TableCell>
                                            <TableCell>{mat.unidad}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default function G_RFQ_List({ onSelectRequisicion }) {
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRfqId, setSelectedRfqId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRequisiciones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/rfq/pendientes');
      setRequisiciones(data);
    } catch (err) {
      toast.error(err.error || 'Error al cargar las requisiciones para cotizar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequisiciones();
  }, [fetchRequisiciones]);

  const handleCancel = async (id) => {
    if (window.confirm("¿Estás seguro de que deseas cancelar este RFQ? Esta acción cambiará su estado a 'CANCELADA'.")) {
        try {
            await api.post(`/api/rfq/${id}/cancelar`);
            toast.success("RFQ cancelado correctamente.");
            setRequisiciones(prev => prev.filter(req => req.id !== id));
        } catch (err) {
            toast.error(err.error || "Error al cancelar el RFQ.");
        }
    }
  };

  const openInfoModal = (id) => {
    setSelectedRfqId(id);
    setIsModalOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center mt-10"><CircularProgress /></div>;
  }

  return (
    <>
      <Paper elevation={3} sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow><TableCell>Número RFQ</TableCell><TableCell>Creador</TableCell><TableCell>Sitio</TableCell><TableCell>Proyecto</TableCell><TableCell>Fecha Creación</TableCell><TableCell align="center">Acciones</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {requisiciones.length > 0 ? (
                requisiciones.map(req => (
                  <TableRow hover key={req.id}>
                    <TableCell>{req.rfq_code}</TableCell>
                    <TableCell>{req.usuario_creador}</TableCell>
                    <TableCell>{req.sitio}</TableCell>
                    <TableCell>{req.proyecto}</TableCell>
                    <TableCell>{new Date(req.fecha_creacion).toLocaleDateString()}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver detalles completos">
                        <IconButton onClick={() => openInfoModal(req.id)}><InfoIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Cotizar esta requisición">
                        <IconButton onClick={() => onSelectRequisicion(req.id)} color="primary"><AssignmentIcon /></IconButton>
                      </Tooltip>
                       <Tooltip title="Cancelar RFQ">
                        <IconButton onClick={() => handleCancel(req.id)} color="error"><CancelIcon /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No hay requisiciones pendientes de cotización.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <InfoModal open={isModalOpen} onClose={() => setIsModalOpen(false)} rfqId={selectedRfqId} />
    </>
  );
}