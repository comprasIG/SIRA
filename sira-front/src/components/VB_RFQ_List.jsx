// C:\SIRA\sira-front\src\components\VB_RFQ_List.jsx
/**
 * =================================================================================================
 * COMPONENTE: VB_RFQ_List (Visto Bueno - RFQ)
 * =================================================================================================
 * @file VB_RFQ_List.jsx
 * @description Muestra la lista de RFQs pendientes de aprobación y orquesta las acciones
 * de ver información, editar, rechazar y abrir el modal de pre-aprobación.
 * También gestiona un estado de carga global para mostrar un overlay en toda la
 * pantalla durante acciones críticas.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Tooltip, IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import RfqApprovalModal from './vb_rfq/RfqApprovalModal';
import RfqInfoModal from './vb_rfq/RfqInfoModal';
import FullScreenLoader from './ui/FullScreenLoader'; // Asegúrate de que esta ruta sea correcta

export default function VB_RFQ_List({ onEdit }) {
  // --- Estados del Componente ---
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState({ open: false, rfqId: null });
  const [infoModal, setInfoModal] = useState({ open: false, rfqId: null });
  // Estado para controlar el loader de pantalla completa
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // --- Carga de Datos ---
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

  // --- Manejadores de Eventos ---
  const handleReject = (id) => {
    if (window.confirm("¿Estás seguro de RECHAZAR este RFQ? Se devolverá al comprador para su corrección.")) {
      // Activamos el loader global para la acción de rechazar
      setIsProcessingAction(true);
      api.post(`/api/rfq/${id}/rechazar`)
        .then(res => {
          toast.success(res.mensaje || 'RFQ devuelto a cotización.');
          fetchRfqs();
        })
        .catch(err => toast.error(err.error || 'La acción falló.'))
        .finally(() => setIsProcessingAction(false)); // Desactivamos el loader al finalizar
    }
  };

  // --- Renderizado ---
  if (loading) return <div className="flex justify-center mt-10"><CircularProgress /></div>;

  return (
    <>
      <FullScreenLoader isOpen={isProcessingAction} message="Procesando, por favor espera..." />

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
                      <Tooltip title="Ver Detalles del RFQ">
                        <IconButton onClick={() => setInfoModal({ open: true, rfqId: rfq.id })} color="info" disabled={isProcessingAction}>
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revisar y Generar OCs">
                        <IconButton onClick={() => setApprovalModal({ open: true, rfqId: rfq.id })} color="success" disabled={isProcessingAction}>
                          <CheckCircleIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rechazar (Devolver a Compras)">
                        <IconButton onClick={() => handleReject(rfq.id)} color="warning" disabled={isProcessingAction}>
                          <DoNotDisturbIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar Cotización">
                        <IconButton onClick={() => onEdit(rfq.id)} color="primary" disabled={isProcessingAction}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>No hay cotizaciones pendientes de aprobación.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      <RfqApprovalModal
        open={approvalModal.open}
        onClose={() => setApprovalModal({ open: false, rfqId: null })}
        rfqId={approvalModal.rfqId}
        refreshList={fetchRfqs}
        setGlobalLoading={setIsProcessingAction}
      />
      <RfqInfoModal
        open={infoModal.open}
        onClose={() => setInfoModal({ open: false, rfqId: null })}
        rfqId={infoModal.rfqId}
      />
    </>
  );
}