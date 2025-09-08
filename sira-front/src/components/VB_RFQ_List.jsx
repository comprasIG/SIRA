// C:\SIRA\sira-front\src\components\VB_RFQ_List.jsx
/**
 * =================================================================================================
 * COMPONENTE: VB_RFQ_List (Visto Bueno - RFQ)
 * =================================================================================================
 * @file VB_RFQ_List.jsx
 * @description Muestra la lista de RFQs pendientes de aprobación y orquesta las acciones
 * de ver información, editar, rechazar y abrir el modal de pre-aprobación.
 * @props {function} onEdit - Callback para abrir el formulario de cotización en modo edición.
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
import InfoIcon from '@mui/icons-material/Info'; // Icono para el botón de información
import RfqApprovalModal from './vb_rfq/RfqApprovalModal';
import RfqInfoModal from './vb_rfq/RfqInfoModal'; // Importamos el nuevo modal de información

export default function VB_RFQ_List({ onEdit }) {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- MEJORA: Separamos el estado de los dos modales para mayor claridad ---
  const [approvalModal, setApprovalModal] = useState({ open: false, rfqId: null });
  const [infoModal, setInfoModal] = useState({ open: false, rfqId: null });

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

  useEffect(() => { fetchRfqs(); }, [fetchRfqs]);

  const handleReject = (id) => {
    if (window.confirm("¿Estás seguro de RECHAZAR este RFQ? Se devolverá al comprador para su corrección.")) {
      api.post(`/api/rfq/${id}/rechazar`)
        .then(res => {
          toast.success(res.mensaje || 'RFQ devuelto a cotización.');
          fetchRfqs();
        })
        .catch(err => toast.error(err.error || 'La acción falló.'));
    }
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
                      {/* --- ¡NUEVO! Botón de Información --- */}
                      <Tooltip title="Ver Detalles del RFQ">
                        <IconButton onClick={() => setInfoModal({ open: true, rfqId: rfq.id })} color="info">
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revisar y Generar OCs">
                        <IconButton onClick={() => setApprovalModal({ open: true, rfqId: rfq.id })} color="success">
                          <CheckCircleIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rechazar (Devolver a Compras)">
                        <IconButton onClick={() => handleReject(rfq.id)} color="warning">
                          <DoNotDisturbIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar Cotización (sólo líneas pendientes)">
                        <IconButton onClick={() => onEdit(rfq.id)} color="primary">
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
      
      {/* Se renderizan ambos modales */}
      <RfqApprovalModal
        open={approvalModal.open}
        onClose={() => setApprovalModal({ open: false, rfqId: null })}
        rfqId={approvalModal.rfqId}
        refreshList={fetchRfqs}
      />
      <RfqInfoModal
        open={infoModal.open}
        onClose={() => setInfoModal({ open: false, rfqId: null })}
        rfqId={infoModal.rfqId}
      />
    </>
  );
}