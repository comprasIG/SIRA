// C:\SIRA\sira-front\src\components\G_RFQ_List.jsx
/**
 * Componente: G_RFQ_List
 * * Propósito:
 * Muestra una lista de las Solicitudes de Cotización (RFQ) que están pendientes.
 * Permite al usuario ver detalles, iniciar el proceso de cotización o cancelar un RFQ.
 * * Props:
 * - onSelectRequisicion (function): Callback que se ejecuta cuando el usuario
 * selecciona un RFQ para cotizar, pasando el ID del RFQ.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Button, CircularProgress, Tooltip, IconButton
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoIcon from '@mui/icons-material/Info';
import CancelIcon from '@mui/icons-material/Cancel';
import RFQInfoModal from './rfq/RFQInfoModal'; // <-- MODIFICACIÓN: Importación del nuevo componente

export default function G_RFQ_List({ onSelectRequisicion }) {
  // --- Estados ---
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRfqId, setSelectedRfqId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Carga de Datos ---
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

  // --- Manejadores de Eventos ---
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

  // --- Renderizado ---
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
      {/* --- MODIFICACIÓN: Se usa el componente importado --- */}
      <RFQInfoModal open={isModalOpen} onClose={() => setIsModalOpen(false)} rfqId={selectedRfqId} />
    </>
  );
}