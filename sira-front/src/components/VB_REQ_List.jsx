// src/components/VB_REQ_List.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';

// Helper para truncar texto
const truncateText = (text, maxLength = 30) => {
  if (!text) return 'N/A';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Componente para una fila de la tabla de requisiciones (ORDEN DE CELDAS CAMBIADO)
const RequisicionRow = ({ req, onApprove, onReject, onViewDetails }) => (
  <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
    <TableCell>
      <Chip label={req.numero_requisicion} color="primary" variant="outlined" size="small" />
    </TableCell>
    <TableCell>{req.usuario_creador}</TableCell>
    {/* --- ORDEN CAMBIADO --- */}
    <TableCell>{req.sitio}</TableCell>
    <TableCell>{req.proyecto}</TableCell>
    <TableCell>
      <Tooltip title={req.comentario || 'Sin comentario'} placement="top">
        <span>{truncateText(req.comentario)}</span>
      </Tooltip>
    </TableCell>
    <TableCell>{new Date(req.fecha_requerida).toLocaleDateString()}</TableCell>
    <TableCell>
      <Chip label={req.status} color={req.status === 'ABIERTA' ? 'warning' : 'default'} size="small" />
    </TableCell>
    <TableCell align="right">
      <Tooltip title="Ver Detalles">
        <IconButton onClick={() => onViewDetails(req.id)} color="default"><InfoIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Aprobar y Enviar a Compras">
        <IconButton onClick={() => onApprove(req.id)} color="success"><CheckCircleIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Rechazar Requisición">
        <IconButton onClick={() => onReject(req.id)} color="error"><CancelIcon /></IconButton>
      </Tooltip>
    </TableCell>
  </TableRow>
);

// Componente para el modal de detalles (sin cambios)
const DetalleRequisicionModal = ({ requisicion, open, onClose }) => {
  if (!requisicion) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Detalle de Requisición: <strong>{requisicion.numero_requisicion}</strong>
      </DialogTitle>
      <DialogContent dividers>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <p><strong>Creador:</strong> {requisicion.usuario_creador}</p>
          <p><strong>Proyecto:</strong> {requisicion.proyecto}</p>
          <p><strong>Fecha Requerida:</strong> {new Date(requisicion.fecha_requerida).toLocaleDateString()}</p>
          <p><strong>Lugar de Entrega:</strong> {requisicion.lugar_entrega}</p>
          {requisicion.comentario_general && (
            <p className="col-span-2"><strong>Comentario General:</strong> {requisicion.comentario_general}</p>
          )}
        </div>
        <h4 className="font-semibold text-lg mb-2">Materiales:</h4>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Material</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell>Unidad</TableCell>
                <TableCell>Comentario</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requisicion.materiales?.map(mat => (
                <TableRow key={mat.id}>
                  <TableCell>{mat.material}</TableCell>
                  <TableCell align="right">{mat.cantidad}</TableCell>
                  <TableCell>{mat.unidad}</TableCell>
                  <TableCell>{mat.comentario || 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

// Componente principal de la lista
export default function VB_REQ_List() {
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRequisiciones = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/requisiciones/por-aprobar');
      setRequisiciones(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.error || 'Error al cargar las requisiciones.');
      toast.error(err.error || 'Error al cargar las requisiciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequisiciones();
  }, [fetchRequisiciones]);

  const handleAction = async (action, id, successMsg) => {
    if (!window.confirm(`¿Estás seguro de que deseas ${successMsg.split(' ')[1]} esta requisición?`)) return;

    try {
      await action(id);
      toast.success(successMsg);
      setRequisiciones(prev => prev.filter(req => req.id !== id));
    } catch (err) {
      console.error(err);
      toast.error(err.error || `Error al procesar la requisición.`);
    }
  };

  const handleApprove = (id) => handleAction(
    () => api.post(`/api/requisiciones/${id}/aprobar`),
    id,
    'Requisición aprobada con éxito.'
  );

  const handleReject = (id) => handleAction(
    () => api.post(`/api/requisiciones/${id}/rechazar`),
    id,
    'Requisición rechazada con éxito.'
  );

  const handleViewDetails = async (id) => {
    try {
      const data = await api.get(`/api/requisiciones/${id}`);
      setSelectedReq(data);
      setIsModalOpen(true);
    } catch (err) {
      toast.error('No se pudo cargar el detalle de la requisición.');
    }
  };

  if (loading) return <div className="flex justify-center mt-10"><CircularProgress /></div>;
  if (error) return <p className="text-red-500 text-center mt-10">{error}</p>;

  return (
    <>
      <Paper elevation={3} sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 200px)' }}>
          <Table stickyHeader aria-label="tabla de requisiciones">
            {/* --- ENCABEZADO CON ORDEN CAMBIADO --- */}
            <TableHead>
              <TableRow>
                <TableCell>Número Req.</TableCell>
                <TableCell>Creador</TableCell>
                <TableCell>Sitio</TableCell>
                <TableCell>Proyecto</TableCell>
                <TableCell>Comentario General</TableCell>
                <TableCell>Fecha Requerida</TableCell>
                <TableCell>Estatus</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requisiciones.length > 0 ? (
                requisiciones.map(req => (
                  <RequisicionRow 
                    key={req.id} 
                    req={req} 
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewDetails={handleViewDetails}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    No hay requisiciones pendientes de aprobación en tu departamento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <DetalleRequisicionModal 
        requisicion={selectedReq}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}