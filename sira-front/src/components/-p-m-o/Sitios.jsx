// C:\SIRA\sira-front\src\components\-p-m-o\Sitios.jsx
import React, { useState, useEffect, useMemo } from 'react';
import KPISitios from './sitios/sitios_kpi';
import FiltrosSitios from './sitios/FiltrosSitios';
import TablaSitios from './sitios/TablaSitios';
import ModalNuevoSitio from './sitios/ModalNuevoSitio';
import ModalNuevoCliente from './sitios/ModalNuevoCliente';
import ModalVerProyectosSitio from './sitios/ModalVerProyectosSitio';
import api from '../../api/api';

export default function Sitios() {
  const [loading, setLoading] = useState(true);
  const [sitios, setSitios] = useState([]);
  const [kpiData, setKpiData] = useState({});
  const [busqueda, setBusqueda] = useState('');

  // Modales: Sitio / Cliente
  const [modalSitioOpen, setModalSitioOpen] = useState(false);
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [sitioAEditar, setSitioAEditar] = useState(null);

  // Modal: Ver Proyectos
  const [modalProyectosOpen, setModalProyectosOpen] = useState(false);
  const [sitioParaProyectos, setSitioParaProyectos] = useState(null);

  // ----------------------------------------------------------------------------
  // Helpers: mapear totales OC por sitio -> { [sitio_id]: [{moneda, subtotal}] }
  // ----------------------------------------------------------------------------
  const buildOcTotalsMap = (rows) => {
    const map = new Map();
    if (!Array.isArray(rows)) return map;

    for (const r of rows) {
      const sitioId = Number(r.sitio_id);
      const moneda = String(r.moneda || '').trim();
      const subtotal = Number(r.subtotal || 0);

      if (!sitioId || !moneda) continue;

      if (!map.has(sitioId)) map.set(sitioId, []);
      map.get(sitioId).push({ moneda, subtotal });
    }

    // Orden consistente (MXN primero, luego USD, luego alfabético)
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const pref = (m) => (m === 'MXN' ? 0 : m === 'USD' ? 1 : 2);
        const pa = pref(a.moneda);
        const pb = pref(b.moneda);
        if (pa !== pb) return pa - pb;
        return a.moneda.localeCompare(b.moneda);
      });
      map.set(k, arr);
    }

    return map;
  };

  // ----------------------------------------------------------------------------
  // Cargar datos
  // ----------------------------------------------------------------------------
  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpisRes, sitiosRes, ocTotalesRes] = await Promise.all([
        api.get('/api/sitios-dashboard/kpis'),
        api.get('/api/sitios-dashboard'),
        api.get('/api/sitios-dashboard/oc-totales-por-sitio'),
      ]);

      const ocMap = buildOcTotalsMap(ocTotalesRes);

      const sitiosConTotales = Array.isArray(sitiosRes)
        ? sitiosRes.map((s) => {
            const sitioId = Number(s.id);
            return {
              ...s,
              oc_totales_por_moneda: ocMap.get(sitioId) || [],
            };
          })
        : [];

      setKpiData(kpisRes || {});
      setSitios(sitiosConTotales);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setSitios([]);
      setKpiData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ----------------------------------------------------------------------------
  // Guardar Sitio (nuevo o edición futura)
  // ----------------------------------------------------------------------------
  const handleGuardarSitio = async (formData) => {
    try {
      const payload = {
        ...formData,
        cliente_id: formData.clienteId || formData.cliente_id,
      };
      delete payload.clienteId;

      if (sitioAEditar) {
        // edición futura (cuando exista endpoint PUT)
        // await api.put(`/api/sitios-dashboard/${sitioAEditar.id}`, payload);
      } else {
        await api.post('/api/sitios-dashboard', payload);
      }

      await fetchData();
      setModalSitioOpen(false);
      setSitioAEditar(null);
    } catch (error) {
      console.error('Error al guardar sitio:', error);
      throw error;
    }
  };

  // ----------------------------------------------------------------------------
  // Guardar Cliente
  // ----------------------------------------------------------------------------
  const handleGuardarCliente = async (clienteData) => {
    try {
      await api.post('/api/sitios-dashboard/cliente', clienteData);
      await fetchData();
      setModalClienteOpen(false);
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      throw error;
    }
  };

  // ----------------------------------------------------------------------------
  // Filtrado
  // ----------------------------------------------------------------------------
  const sitiosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return sitios || [];
    return (sitios || []).filter(
      (s) =>
        s.nombre?.toLowerCase().includes(q) ||
        s.cliente_nombre?.toLowerCase().includes(q) ||
        s.ubicacion?.toLowerCase().includes(q)
    );
  }, [sitios, busqueda]);

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Sitios</h1>
        <p className="text-gray-500 mt-2">
          Administra las ubicaciones y clientes de tus proyectos.
        </p>
      </header>

      {/* KPIs */}
      <KPISitios data={kpiData} />

      {/* Filtros */}
      <FiltrosSitios
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        onNuevoSitio={() => {
          setSitioAEditar(null);
          setModalSitioOpen(true);
        }}
        onNuevoCliente={() => setModalClienteOpen(true)}
      />

      {/* Tabla */}
      <TablaSitios
        sitios={sitiosFiltrados}
        loading={loading}
        onVerProyectos={(sitio) => {
          setSitioParaProyectos(sitio);
          setModalProyectosOpen(true);
        }}
        onEditar={(sitio) => {
          setSitioAEditar(sitio);
          setModalSitioOpen(true);
        }}
      />

      {/* Modales */}
      {modalSitioOpen && (
        <ModalNuevoSitio
          isOpen={modalSitioOpen}
          onClose={() => setModalSitioOpen(false)}
          onSave={handleGuardarSitio}
          sitioEditar={sitioAEditar}
        />
      )}

      {modalClienteOpen && (
        <ModalNuevoCliente
          isOpen={modalClienteOpen}
          onClose={() => setModalClienteOpen(false)}
          onSave={handleGuardarCliente}
        />
      )}

      {modalProyectosOpen && (
        <ModalVerProyectosSitio
          isOpen={modalProyectosOpen}
          onClose={() => setModalProyectosOpen(false)}
          sitio={sitioParaProyectos}
        />
      )}
    </div>
  );
}
