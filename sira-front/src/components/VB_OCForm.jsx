// C:\SIRA\sira-front\src\components\VB_OCForm.jsx
import React, { useEffect, useState } from 'react';
import { Button, CircularProgress, Paper } from '@mui/material';
import { toast } from 'react-toastify';
import api from '../api/api';

export default function VB_OCForm() {
  const [ocs, setOcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [accionando, setAccionando] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/oc-extra?status=EN_REVISION');
      setOcs(data || []);
      if (data && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (error) {
      console.error('[ExtraOC] Error al listar OCs extraordinarias', error);
      toast.error(error?.error || 'No fue posible cargar las OCs extraordinarias.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalle = async (id) => {
    try {
      const data = await api.get(`/api/oc-extra/${id}`);
      setDetalle(data);
    } catch (error) {
      console.error('[ExtraOC] Error al cargar detalle', error);
      toast.error(error?.error || 'No fue posible cargar el detalle de la OC.');
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetalle(selectedId);
  }, [selectedId]);

  const aprobar = async () => {
    if (!detalle) return;
    try {
      setAccionando(true);
      await api.post(`/api/oc-extra/${detalle.id}/aprobar`, { comentarios: 'Aprobado desde VB_OC' });
      toast.success('OC extraordinaria aprobada.');
      await fetchList();
      setDetalle(null);
    } catch (error) {
      console.error('[ExtraOC] Error al aprobar OC', error);
      toast.error(error?.error || 'No fue posible aprobar la OC.');
    } finally {
      setAccionando(false);
    }
  };

  const rechazar = async () => {
    if (!detalle) return;
    const motivo = window.prompt('Indica el motivo del rechazo');
    if (motivo === null) return;
    try {
      setAccionando(true);
      await api.post(`/api/oc-extra/${detalle.id}/rechazar`, { comentarios: motivo });
      toast.info('OC extraordinaria rechazada.');
      await fetchList();
      setDetalle(null);
    } catch (error) {
      console.error('[ExtraOC] Error al rechazar OC', error);
      toast.error(error?.error || 'No fue posible rechazar la OC.');
    } finally {
      setAccionando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <CircularProgress />
      </div>
    );
  }

  const OcCard = ({ oc, onSelect, isActive }) => {
    const datos = oc.datos_generales || {};
    const total = oc.totales?.total || 0;
    return (
      <button
        onClick={() => onSelect(oc.id)}
        className={`w-full text-left p-4 rounded-lg border transition ${
          isActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex justify-between text-sm text-gray-500">
          <span>{oc.codigo}</span>
          <span>{new Date(oc.creado_en).toLocaleString()}</span>
        </div>
        <div className="text-lg font-semibold text-gray-800 mt-1">{datos.sitioNombre || 'Sitio no definido'}</div>
        <div className="text-sm text-gray-600">Proyecto: {datos.proyectoNombre || 'N/D'}</div>
        <div className="text-sm text-gray-600">Total: ${Number(total).toFixed(2)} {oc.totales?.moneda || 'MXN'}</div>
      </button>
    );
  };

  const OcDetalle = ({ oc, onAprobar, onRechazar }) => {
    if (!oc) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          Selecciona una OC extraordinaria para revisar sus detalles.
        </div>
      );
    }

    const datos = oc.datos_generales || {};
    const materiales = oc.materiales || [];
    const totales = oc.totales || {};

    return (
      <Paper elevation={2} className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{oc.codigo}</h2>
          <p className="text-sm text-gray-500">Sitio: {datos.sitioNombre || 'N/D'} — Proyecto: {datos.proyectoNombre || 'N/D'}</p>
          <p className="text-sm text-gray-500">Lugar de entrega: {datos.lugarEntrega || 'N/D'}</p>
          <p className="text-sm text-gray-500">Comentario: {datos.comentario || 'Sin comentario'}</p>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Material</th>
                <th className="px-4 py-2 text-left">Proveedor</th>
                <th className="px-4 py-2 text-right">Cantidad</th>
                <th className="px-4 py-2 text-right">Precio unitario</th>
                <th className="px-4 py-2 text-right">Total línea</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((item, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="px-4 py-2">{item.descripcion_manual || item.material?.nombre || 'Material'}</td>
                  <td className="px-4 py-2">{item.proveedor_manual || item.proveedor?.nombre || 'Proveedor'}</td>
                  <td className="px-4 py-2 text-right">{Number(item.cantidad || 0).toFixed(2)} {item.unidad}</td>
                  <td className="px-4 py-2 text-right">${Number(item.precio_unitario || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${Number(item.total_linea || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end space-y-1 text-sm text-gray-600">
          <div>Subtotal: ${Number(totales.subTotal || 0).toFixed(2)} {totales.moneda || 'MXN'}</div>
          <div>IVA: ${Number(totales.iva || 0).toFixed(2)} {totales.moneda || 'MXN'}</div>
          <div className="text-lg font-semibold text-gray-800">
            Total: ${Number(totales.total || 0).toFixed(2)} {totales.moneda || 'MXN'}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outlined" color="error" onClick={onRechazar}>
            Rechazar
          </Button>
          <Button variant="contained" color="primary" onClick={onAprobar}>
            Aprobar
          </Button>
        </div>
      </Paper>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-3 max-h-[75vh] overflow-auto">
        {ocs.length === 0 && <div className="text-gray-500">No hay OCs extraordinarias en revisión.</div>}
        {ocs.map((oc) => (
          <OcCard key={oc.id} oc={oc} onSelect={setSelectedId} isActive={selectedId === oc.id} />
        ))}
      </div>
      <div className="lg:col-span-3">
        {accionando && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <CircularProgress size={16} />
            Procesando acción…
          </div>
        )}
        <OcDetalle oc={detalle} onAprobar={aprobar} onRechazar={rechazar} />
      </div>
    </div>
  );
}
