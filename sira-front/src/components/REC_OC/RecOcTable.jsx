// src/components/REC_OC/RecOcTable.jsx
import React, { useEffect, useState } from 'react';
import { Paper, Table, TableHead, TableRow, TableCell, TableBody, IconButton } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import HistoryIcon from '@mui/icons-material/History';
import useRecOcList from './hooks/useRecOcList';

export default function RecOcTable({ filtros, onMetodo, onNotificar, onArchivos, onHistorial, reload }) {
  const { ocs, loading } = useRecOcList(filtros, reload, 'pendientes');
  const [order, setOrder] = useState([]);

  useEffect(()=> setOrder(ocs.map(x=>x.id)), [ocs]);
  const rows = order.map(id => ocs.find(x=>x.id===id)).filter(Boolean);

  if (loading) return <Paper sx={{p:2}}>Cargando...</Paper>;
  if (!rows.length) return <Paper sx={{p:2}}>Sin OCs pendientes.</Paper>;

  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>OC</TableCell>
            <TableCell>Proveedor</TableCell>
            <TableCell>Proyecto</TableCell>
            <TableCell>Sitio</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row=>(
            <TableRow key={row.id} hover>
              <TableCell>{row.numero_oc}</TableCell>
              <TableCell>{row.proveedor_nombre}</TableCell>
              <TableCell>{row.proyecto_nombre}</TableCell>
              <TableCell>{row.sitio_nombre}</TableCell>
              <TableCell align="right">{row.total}</TableCell>
              <TableCell align="center">
                <IconButton title="Definir método" onClick={()=>onMetodo(row)}><BuildIcon/></IconButton>
                <IconButton title="Notificar" onClick={()=>onNotificar(row)}><SendIcon/></IconButton>
                <IconButton title="Archivos" onClick={()=>onArchivos(row)}><AttachFileIcon/></IconButton>
                <IconButton title="Historial" onClick={()=>onHistorial(row)}><HistoryIcon/></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
