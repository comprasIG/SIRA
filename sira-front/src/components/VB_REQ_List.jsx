//C:\SIRA\sira-front\src\components\VB_REQ_List.jsx
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

// --- Helper Component ---
const truncateText = (text, maxLength = 30) => {
  if (!text) return 'N/A';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
};

// --- Row Component ---
// CHANGE: It now accepts an 'isProcessing' prop to disable its buttons.
const RequisicionRow = ({ req, onApprove, onReject, onViewDetails, onEdit, isProcessing }) => (
    <TableRow hover>
        <TableCell><Chip label={req.numero_requisicion} color="primary" variant="outlined" size="small" /></TableCell>
        <TableCell>{req.usuario_creador}</TableCell>
        <TableCell>{req.sitio}</TableCell>
        <TableCell>{req.proyecto}</TableCell>
        <TableCell><Tooltip title={req.comentario || 'Sin comentario'} placement="top"><span>{truncateText(req.comentario)}</span></Tooltip></TableCell>
        <TableCell>{new Date(req.fecha_requerida).toLocaleDateString()}</TableCell>
        <TableCell><Chip label={req.status} color={req.status === 'ABIERTA' ? 'warning' : 'default'} size="small" /></TableCell>
        <TableCell align="right">
            {/* The buttons are now disabled if this specific row is being processed */}
            <Tooltip title="Aprobar y Enviar a Compras">
                <span>
                    <IconButton onClick={() => onApprove(req.id)} color="success" disabled={isProcessing}>
                        {isProcessing ? <CircularProgress size={24} color="inherit" /> : <CheckCircleIcon />}
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="Rechazar Requisición"><IconButton onClick={() => onReject(req.id)} color="error" disabled={isProcessing}><CancelIcon /></IconButton></Tooltip>
            <Tooltip title="Ver Detalles"><IconButton onClick={() => onViewDetails(req.id)} color="default" disabled={isProcessing}><InfoIcon /></IconButton></Tooltip>
            <Tooltip title="Editar Requisición"><IconButton onClick={() => onEdit(req.id)} color="primary" disabled={isProcessing}><EditIcon /></IconButton></Tooltip>
        </TableCell>
    </TableRow>
);

// --- Detail Modal Component ---
const DetalleRequisicionModal = ({ requisicion, open, onClose }) => {
    if (!requisicion) return null;
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Detalle de Requisición: <strong>{requisicion.numero_requisicion}</strong></DialogTitle>
            <DialogContent dividers>
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
                                <TableRow key={mat.material_id || mat.id}>
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

// --- Main Component ---
export default function VB_REQ_List({ onEdit }) {
    // --- States ---
    const [requisiciones, setRequisiciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReq, setSelectedReq] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // CHANGE: New state to track the ID of the requisition being processed.
    const [processingId, setProcessingId] = useState(null);
    const { usuario } = useAuth();

    // --- Data Fetching ---
    const fetchRequisiciones = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.get('/api/requisiciones/por-aprobar');
            setRequisiciones(data);
            setError(null);
        } catch (err) {
            setError(err.error || 'Error al cargar las requisiciones.');
            toast.error(err.error || 'Error al cargar las requisiciones.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequisiciones();
    }, [fetchRequisiciones]);

    // --- Action Handlers ---
    const handleApprove = async (id) => {
        if (!window.confirm(`¿Estás seguro de APROBAR esta requisición? El PDF se descargará y se enviará una notificación.`)) return;
        if (!usuario) return toast.error("No se pudo identificar al usuario. Por favor, recarga la página.");
        
        setProcessingId(id); // Set the ID to disable buttons for this row
        try {
            toast.info('Procesando aprobación, por favor espera...');
            const response = await api.post(
                `/api/requisiciones/${id}/aprobar-y-notificar`,
                { approverName: usuario.nombre || 'Aprobador del Sistema' },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = response.headers['content-disposition'];
            let fileName = `Requisicion_${id}.pdf`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
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
            console.error("Error en el proceso de aprobación:", err);
            if (err.response && err.response.data) {
                toast.error(err.response.data.error || 'Error del servidor al aprobar.');
            } else if (err.message) {
                toast.error(err.message);
            } else {
                toast.error('Ocurrió un error inesperado al procesar la aprobación.');
            }
        } finally {
            setProcessingId(null); // Clear the ID to re-enable buttons
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("¿Estás seguro de RECHAZAR esta requisición?")) return;
        
        setProcessingId(id); // Set the ID to disable buttons
        try {
            await api.post(`/api/requisiciones/${id}/rechazar`);
            toast.warn("Requisición rechazada.");
            fetchRequisiciones();
        } catch (err) {
            toast.error(err.error || "Error al rechazar la requisición.");
        } finally {
            setProcessingId(null); // Clear the ID to re-enable buttons
        }
    };
    
    const handleViewDetails = async (id) => {
        try {
            const data = await api.get(`/api/requisiciones/${id}`);
            setSelectedReq(data);
            setIsModalOpen(true);
        } catch (err) {
            toast.error("No se pudo cargar el detalle de la requisición.");
        }
    };

    // --- Render Logic ---
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
                                    <RequisicionRow
                                        key={req.id}
                                        req={req}
                                        onApprove={handleApprove}
                                        onReject={handleReject}
                                        onViewDetails={handleViewDetails}
                                        onEdit={onEdit}
                                        // Pass the boolean to the row
                                        isProcessing={processingId === req.id}
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