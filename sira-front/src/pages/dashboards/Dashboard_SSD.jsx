// src/pages/dashboards/Dashboard_SSD.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Typography, Select, MenuItem, FormControl, InputLabel, Chip, Box
} from '@mui/material';

// Opciones para los filtros, basadas en tu DDL
const rfqStatusOptions = ['COTIZANDO', 'POR_APROBAR', 'ORDEN_GENERADA', 'ESPERANDO_ENTREGA', 'ENTREGADA', 'CANCELADA'];
const ocStatusOptions = ['POR_AUTORIZAR', 'ABIERTA', 'APROBADA', 'RECHAZADA', 'EN_PROCESO', 'ENTREGADA', 'CANCELADA'];

const statusColors = {
  COTIZANDO: 'primary',
  POR_APROBAR: 'warning',
  POR_AUTORIZAR: 'warning',
  ORDEN_GENERADA: 'success',
  ESPERANDO_ENTREGA: 'info',
  ENTREGADA: 'success',
  CANCELADA: 'default',
  RECHAZADA: 'error',
  ABIERTA: 'secondary',
  APROBADA: 'success',
  EN_PROCESO: 'info'
};

export default function Dashboard_SSD() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ rfq_status: '', oc_status: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/api/dashboard/compras?${params}`);
      setData(response);
    } catch (err) {
      toast.error(err.error || 'Error al cargar los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <Typography variant="h4" component="h1" className="font-bold text-gray-800">Dashboard de Compras</Typography>
      
      {/* Sección de Filtros */}
      <Paper elevation={2} className="p-4">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="h6">Filtros:</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Estado RFQ</InputLabel>
            <Select name="rfq_status" value={filters.rfq_status} label="Estado RFQ" onChange={handleFilterChange}>
              <MenuItem value=""><em>Todos</em></MenuItem>
              {rfqStatusOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Estado OC</InputLabel>
            <Select name="oc_status" value={filters.oc_status} label="Estado OC" onChange={handleFilterChange}>
              <MenuItem value=""><em>Todos</em></MenuItem>
              {ocStatusOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Tabla de Resultados */}
      <Paper elevation={3} sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
          ) : (
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
                {data.map((rfq) => (
                  <TableRow hover key={rfq.rfq_id}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{rfq.rfq_code}</TableCell>
                    <TableCell>
                        <Typography variant="body2">{rfq.sitio}</Typography>
                        <Typography variant="caption" color="textSecondary">{rfq.proyecto}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={rfq.rfq_status} color={statusColors[rfq.rfq_status] || 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      {rfq.ordenes.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {rfq.ordenes.map((oc, index) => (
                            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Typography variant="body2">{oc.numero_oc}:</Typography>
                              <Chip label={oc.oc_status} color={statusColors[oc.oc_status] || 'default'} size="small" />
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="textSecondary">Sin OCs generadas</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>
    </div>
  );
}