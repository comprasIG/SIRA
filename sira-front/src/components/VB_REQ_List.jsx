import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { toast } from 'react-toastify';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Tooltip, Link, Box
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useAuth } from '../context/authContext';

// --- Helper sin cambios ---
const truncateText = (text, maxLength = 30) => {
  if (!text) return 'N/A';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// --- Componente de Fila sin cambios ---
const RequisicionRow = ({ req, onApprove, onReject, onViewDetails, onEdit }) => (
    <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
        <TableCell><Chip label={req.numero_requisicion} color="primary" variant="outlined" size="small" /></TableCell>
        <TableCell>{req.usuario_creador}</TableCell>
        <TableCell>{req.sitio}</TableCell>
        <TableCell>{req.proyecto}</TableCell>
        <TableCell><Tooltip title={req.comentario || 'Sin comentario'} placement="top"><span>{truncateText(req.comentario)}</span></Tooltip></TableCell>
        <TableCell>{new Date(req.fecha_requerida).toLocaleDateString()}</TableCell>
        <TableCell><Chip label={req.status} color={req.status === 'ABIERTA' ? 'warning' : 'default'} size="small" /></TableCell>
        <TableCell align="right">
            <Tooltip title="Aprobar y Enviar a Compras"><IconButton onClick={() => onApprove(req.id)} color="success"><CheckCircleIcon /></IconButton></Tooltip>
            <Tooltip title="Rechazar Requisición"><IconButton onClick={() => onReject(req.id)} color="error"><CancelIcon /></IconButton></Tooltip>
            <Tooltip title="Ver Detalles"><IconButton onClick={() => onViewDetails(req.id)} color="default"><InfoIcon /></IconButton></Tooltip>
            <Tooltip title="Editar Requisición"><IconButton onClick={() => onEdit(req.id)} color="primary"><EditIcon /></IconButton></Tooltip>
        </TableCell>
    </TableRow>
);

// --- Modal de detalles CON CORRECCIÓN DE 'key' ---
const DetalleRequisicionModal = ({ requisicion, open, onClose }) => {
    if (!requisicion) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Detalle de Requisición: <strong>{requisicion.numero_requisicion}</strong></DialogTitle>
            <DialogContent dividers>
                {/* ... (sección de info general sin cambios) ... */}
                <h4 className="font-semibold text-lg mb-2">Materiales:</h4>
                <TableContainer component={Paper} variant="outlined" className='mb-4'>
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
                                // CORRECCIÓN 1: Se añade la prop 'key' a TableRow
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

                {requisicion.adjuntos && requisicion.adjuntos.length > 0 && (
                    <>
                        <h4 className="font-semibold text-lg mb-2">Archivos Adjuntos:</h4>
                        <Box>
                            {requisicion.adjuntos.map(file => (
                                // CORRECCIÓN 2: Se añade la prop 'key' a Link
                                <Link href={file.ruta_archivo} target="_blank" rel="noopener noreferrer" key={file.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <AttachFileIcon sx={{ mr: 1, fontSize: '1rem' }} />
                                    {file.nombre_archivo}
                                </Link>
                            ))}
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
        </Dialog>
    );
};


// --- Componente principal ---
export default function VB_REQ_List({ onEdit }) {
    const [requisiciones, setRequisiciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReq, setSelectedReq] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { usuario } = useAuth();

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

    // --- FUNCIÓN handleApprove CON MANEJO DE ERRORES MEJORADO ---
    const handleApprove = async (id) => {
        if (!window.confirm(`¿Estás seguro de que deseas APROBAR esta requisición? El PDF se descargará y se enviará una notificación por correo.`)) return;
        if (!usuario) {
            toast.error("No se pudo identificar al usuario. Por favor, recarga la página.");
            return;
        }

        try {
            const approverName = usuario.nombre || 'Usuario del Sistema';
            toast.info('Procesando aprobación, generando PDF y enviando correos...');

            const response = await api.post(
                `/api/requisiciones/${id}/aprobar-y-notificar`,
                { approverName: approverName },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = response.headers['content-disposition'];
            let fileName = `Requisicion_${id}.pdf`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
            }
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Requisición aprobada y notificada con éxito.');
            fetchRequisiciones();

        } catch (err) {
            console.error(err);
            // --- BLOQUE CATCH CORREGIDO ---
            // Esta lógica mejorada revisa si el error viene del servidor o de la red.
            if (err.response && err.response.data) {
                // Si el error viene del backend y es un 'blob', no podemos leerlo como JSON.
                // Lo más seguro es mostrar un mensaje genérico o intentar leer el blob.
                // Por simplicidad, mostraremos un mensaje claro.
                if (err.response.data instanceof Blob) {
                    toast.error('El servidor respondió con un error al procesar la requisición.');
                } else {
                    toast.error(err.response.data.error || 'Error en la respuesta del servidor.');
                }
            } else if (err.message) {
                // Si es un error de red (ej. servidor caído) u otro error de cliente
                toast.error(err.message);
            } else {
                // Un fallback por si el objeto de error es inesperado
                toast.error('Ocurrió un error inesperado al procesar la requisición.');
            }
        }
    };

    const handleReject = async (id) => { /* ... (sin cambios) ... */ };
    const handleViewDetails = async (id) => { /* ... (sin cambios) ... */ };

    if (loading) return <div className="flex justify-center mt-10"><CircularProgress /></div>;
    if (error) return <p className="text-red-500 text-center mt-10">{error}</p>;

    return (
        <>
            <Paper elevation={3} sx={{ overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 200px)' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>Número Req.</TableCell>
                                <TableCell>Creador</TableCell>
                                <TableCell>Sitio</TableCell>
                                <TableCell>Proyecto</TableCell>
                                <TableCell>Comentario</TableCell>
                                <TableCell>Fecha Req.</TableCell>
                                <TableCell>Estatus</TableCell>
                                <TableCell align="right">Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {requisiciones.length > 0 ? (
                                requisiciones.map(req => (
                                    // CORRECCIÓN 4: Se añade la prop 'key' al componente RequisicionRow
                                    <RequisicionRow
                                        key={req.id}
                                        req={req}
                                        onApprove={handleApprove}
                                        onReject={handleReject}
                                        onViewDetails={handleViewDetails}
                                        onEdit={onEdit}
                                    />
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No hay requisiciones pendientes de aprobación.</TableCell></TableRow>
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