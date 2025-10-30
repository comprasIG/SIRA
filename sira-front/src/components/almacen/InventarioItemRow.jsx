// sira-front/src/components/almacen/InventarioItemRow.jsx
import React from 'react';
import { TableRow, TableCell, IconButton, Stack, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import MoveUpIcon from '@mui/icons-material/MoveUp';

export default function InventarioItemRow({ item, onOpenModal }) {
    // Usamos los totales sumados
    const disponible = parseFloat(item.total_stock) || 0;
    const apartado = parseFloat(item.total_asignado) || 0;
    const unidad = item.unidad_simbolo;

    const canApartar = disponible > 0;
    const canMover = apartado > 0;
    const canShowInfo = apartado > 0;

    return (
        // Aseguramos fondo blanco para filas hover
        <TableRow hover sx={{ '& > *': { verticalAlign: 'top' }, backgroundColor: 'background.paper' }}>
            <TableCell>{item.sku || '-'}</TableCell>
            <TableCell>{item.material_nombre}</TableCell>
            {/* Formateamos números */}
            <TableCell align="right">{disponible.toLocaleString('es-MX')} {unidad}</TableCell>
            <TableCell align="right">{apartado.toLocaleString('es-MX')} {unidad}</TableCell>
            <TableCell align="center">
                <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="Ver detalle de apartados">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => onOpenModal('info', item)}
                                disabled={!canShowInfo}
                                color="info"
                            >
                                <InfoIcon fontSize="small" />
                            </IconButton>
                         </span>
                    </Tooltip>
                    <Tooltip title="Apartar de stock disponible">
                         <span>
                            <IconButton
                                size="small"
                                onClick={() => onOpenModal('apartar', item)}
                                disabled={!canApartar}
                                color="success"
                            >
                                <AssignmentTurnedInIcon fontSize="small" />
                            </IconButton>
                         </span>
                    </Tooltip>
                    <Tooltip title="Mover entre proyectos (reasignar)">
                         <span>
                             <IconButton
                                size="small"
                                onClick={() => onOpenModal('mover', item)}
                                disabled={!canMover}
                                color="warning"
                            >
                                <MoveUpIcon fontSize="small" />
                            </IconButton>
                         </span>
                    </Tooltip>
                </Stack>
            </TableCell>
        </TableRow>
    );
}