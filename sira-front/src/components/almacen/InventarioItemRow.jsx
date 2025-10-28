// sira-front/src/components/almacen/InventarioItemRow.jsx
import React from 'react';
import { TableRow, TableCell, IconButton, Stack, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'; // Icono para Apartar
import MoveUpIcon from '@mui/icons-material/MoveUp'; // Icono para Mover

export default function InventarioItemRow({ item, onOpenModal }) {
    const disponible = parseFloat(item.total_stock) || 0;
    const apartado = parseFloat(item.total_asignado) || 0;
    const unidad = item.unidad_simbolo;

    const canApartar = disponible > 0;
    const canMover = apartado > 0;
    const canShowInfo = apartado > 0;

    return (
        <TableRow hover sx={{ '& > *': { verticalAlign: 'top' } }}>
            <TableCell>{item.sku || '-'}</TableCell>
            <TableCell>{item.material_nombre}</TableCell>
            <TableCell align="right">{disponible} {unidad}</TableCell>
            <TableCell align="right">{apartado} {unidad}</TableCell>
            <TableCell align="center">
                <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="Ver detalle de apartados">
                        <span> {/* Span necesario para Tooltip en botón deshabilitado */}
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