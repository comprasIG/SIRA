// src/components/-p-m-o/Sitios.jsx
import React, { useState, useEffect } from 'react';
import KPISitios from './sitios/sitios_kpi';
import FiltrosSitios from './sitios/FiltrosSitios';
import TablaSitios from './sitios/TablaSitios';
import ModalNuevoSitio from './sitios/ModalNuevoSitio';
import ModalNuevoCliente from './sitios/ModalNuevoCliente';


import api from '../../api/api';

export default function Sitios() {
  const [loading, setLoading] = useState(true);
  const [sitios, setSitios] = useState([]);
  const [kpiData, setKpiData] = useState({});
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para Modales
  const [modalSitioOpen, setModalSitioOpen] = useState(false);
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [sitioAEditar, setSitioAEditar] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Promise.all para cargar todo junto
      const [kpisRes, sitiosRes] = await Promise.all([
        api.get('/sitios-dashboard/kpis'),
        api.get('/sitios-dashboard')
      ]);
      setKpiData(kpisRes.data);
      setSitios(sitiosRes.data);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lógica de Filtrado
  const sitiosFiltrados = sitios.filter(s => 
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.ubicacion.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Handlers
  const handleGuardarSitio = async (datosSitio) => {
    try {
      await api.post('/sitios-dashboard', datosSitio);
      setModalSitioOpen(false);
      fetchData(); // Recargar datos
    } catch (error) {
      alert("Error al guardar sitio");
    }
  };

  const handleGuardarCliente = async (datosCliente) => {
    try {
      await api.post('/sitios-dashboard/cliente', datosCliente);
      setModalClienteOpen(false);
      // Opcional: Mostrar notificación de éxito
      fetchData(); // Recargar KPIs principalmente
    } catch (error) {
      alert("Error al guardar cliente");
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Sitios</h1>
          <p className="text-gray-500 mt-2">Administra las ubicaciones y clientes de tus proyectos.</p>
        </header>

        {/* Sección 1: KPIs */}
        <KPISitios data={kpiData} />

        {/* Sección 2: Filtros y Acciones */}
        <FiltrosSitios 
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          onNuevoSitio={() => { setSitioAEditar(null); setModalSitioOpen(true); }}
          onNuevoCliente={() => setModalClienteOpen(true)}
        />

        {/* Sección 3: Listado */}
        <TablaSitios 
          sitios={sitiosFiltrados} 
          loading={loading}
          onVerProyectos={(sitio) => console.log("Ver proyectos de", sitio.nombre)}
          onEditar={(sitio) => { setSitioAEditar(sitio); setModalSitioOpen(true); }}
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
      </div>
    </div>
  );
}