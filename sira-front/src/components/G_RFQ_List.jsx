// C:\SIRA\sira-front\src\components\G_RFQ_List.jsx
// C:\SIRA\sira-front\src\components\G_RFQ_List.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Button, CircularProgress, Tooltip
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';

export default function G_RFQ_List({ onSelectRequisicion }) {
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequisiciones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/rfq/pendientes');
      setRequisiciones(data);
    } catch (err) {
      toast.error(err.error || 'Error al cargar las requisiciones para cotizar.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequisiciones();
  }, [fetchRequisiciones]);

  if (loading) {
    return <div className="flex justify-center mt-10"><CircularProgress /></div>;
  }

  return (
    <Paper elevation={3} sx={{ overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
        <Table stickyHeader aria-label="tabla de requisiciones para cotizar">
          <TableHead>
            <TableRow>
              <TableCell>Número Req.</TableCell>
              <TableCell>Creador</TableCell>
              <TableCell>Sitio</TableCell>
              <TableCell>Proyecto</TableCell>
              <TableCell>Fecha Creación</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requisiciones.length > 0 ? (
              requisiciones.map(req => (
                <TableRow hover key={req.id}>
                  <TableCell>{req.numero_requisicion}</TableCell>
                  <TableCell>{req.usuario_creador}</TableCell>
                  <TableCell>{req.sitio}</TableCell>
                  <TableCell>{req.proyecto}</TableCell>
                  <TableCell>{new Date(req.fecha_creacion).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Cotizar esta requisición">
                      <Button
                        variant="contained"
                        startIcon={<AssignmentIcon />}
                        onClick={() => onSelectRequisicion(req.id)}
                      >
                        Cotizar
                      </Button>
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
  );
}