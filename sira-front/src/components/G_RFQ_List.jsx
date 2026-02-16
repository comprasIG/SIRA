// C:\SIRA\sira-front\src\components\G_RFQ_List.jsx (VERSIÓN MEJORADA)

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Box, Paper, CircularProgress, Tooltip, IconButton, Typography,
  Chip // Componentes para la nueva UI
} from '@mui/material';
// Iconos para la nueva UI
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoIcon from '@mui/icons-material/Info';
import CancelIcon from '@mui/icons-material/Cancel';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import InboxIcon from '@mui/icons-material/Inbox';

import RFQInfoModal from './rfq/RFQInfoModal';
import RfqCodeChip from './common/RfqCodeChip';

export default function G_RFQ_List({ onSelectRequisicion }) {
  // --- Estados (sin cambios) ---
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRfqId, setSelectedRfqId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // --- Lógica de Carga y Handlers (sin cambios) ---
  const fetchRequisiciones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/rfq/pendientes');
      setRequisiciones(data);
    } catch (err) {
      toast.error(err.error || 'Error al cargar las requisiciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequisiciones(); }, [fetchRequisiciones]);

  const handleExport = async (rfqId, rfqCode) => {
    setIsProcessingAction(true);
    toast.info("Generando archivo Excel...");
    try {
      const response = await api.get(`/api/rfq/${rfqId}/exportar-excel`, { params: { rfqCode }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RFQ_${rfqCode}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("¡Archivo descargado!");
    } catch (err) {
      toast.error(err.error || 'No se pudo generar el archivo.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancel = async (id) => {
    if (window.confirm("¿Seguro que deseas cancelar este RFQ?")) {
      try {
        await api.post(`/api/rfq/${id}/cancelar`);
        toast.success("RFQ cancelado.");
        setRequisiciones(prev => prev.filter(req => req.id !== id));
      } catch (err) {
        toast.error(err.error || "Error al cancelar.");
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 1 }}>
        {requisiciones.length > 0 ? (
          requisiciones.map(req => (
            <Paper
              key={req.id}
              variant="outlined"
              sx={{
                p: 2.5,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: 'center',
                gap: 2,
                transition: 'box-shadow 0.3s, border-color 0.3s',
                '&:hover': {
                  boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
                  borderColor: 'primary.main',
                }
              }}
            >
              {/* Sección de Información */}
              <Box sx={{ flexGrow: 1, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <RfqCodeChip
                    label={req.rfq_code}
                    onClick={() => openInfoModal(req.id)}
                  />
                  <Chip label={req.proyecto} color="primary" variant="outlined" size="small" />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PersonOutlineIcon fontSize="small" />{req.usuario_creador}</Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><LocationOnOutlinedIcon fontSize="small" />{req.sitio}</Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><CalendarTodayOutlinedIcon fontSize="small" />{new Date(req.fecha_creacion).toLocaleDateString()}</Box>
                </Box>
              </Box>

              {/* Sección de Acciones */}
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Tooltip title="Ver detalles"><IconButton onClick={() => openInfoModal(req.id)} disabled={isProcessingAction}><InfoIcon /></IconButton></Tooltip>
                <Tooltip title="Cotizar"><IconButton onClick={() => onSelectRequisicion(req.id)} color="primary" disabled={isProcessingAction}><AssignmentIcon /></IconButton></Tooltip>
                <Tooltip title="Exportar a Excel"><IconButton onClick={() => handleExport(req.id, req.rfq_code)} color="success" disabled={isProcessingAction}><FileDownloadIcon /></IconButton></Tooltip>
                <Tooltip title="Cancelar RFQ"><IconButton onClick={() => handleCancel(req.id)} color="error" disabled={isProcessingAction}><CancelIcon /></IconButton></Tooltip>
              </Box>
            </Paper>
          ))
        ) : (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <InboxIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography>No hay requisiciones pendientes de cotización.</Typography>
          </Paper>
        )}
      </Box>

      <RFQInfoModal open={isModalOpen} onClose={() => setIsModalOpen(false)} rfqId={selectedRfqId} />
    </>
  );
}