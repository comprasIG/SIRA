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
      const [kpisRes, sitiosRes] = await Promise.all([
        api.get('/api/sitios-dashboard/kpis'),
        api.get('/api/sitios-dashboard')
      ]);
      
      // CORRECCIÓN: Tu api.js devuelve el JSON directo, no un objeto con propiedad .data
      setKpiData(kpisRes || {});
      setSitios(sitiosRes || []);
      
    } catch (error) {
      console.error("Error cargando datos:", error);
      // En caso de error, aseguramos que sea un array vacío para no romper el render
      setSitios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Función para guardar Sitio (Nuevo o Edición)
  const handleGuardarSitio = async (formData) => {
    try {
      // CORRECCIÓN: Adaptador de datos (Frontend camelCase -> Backend snake_case)
      const payload = {
        ...formData,
        cliente_id: formData.clienteId || formData.cliente_id
      };
      delete payload.clienteId;

      if (sitioAEditar) {
        // Futura lógica de edición
        // await api.put(`/api/sitios-dashboard/${sitioAEditar.id}`, payload);
      } else {
        await api.post('/api/sitios-dashboard', payload);
      }
      
      await fetchData();
      setModalSitioOpen(false);
      setSitioAEditar(null);
    } catch (error) {
      console.error("Error al guardar sitio:", error);
      throw error;
    }
  };

  // Función para guardar Cliente
  const handleGuardarCliente = async (clienteData) => {
    try {
      await api.post('/api/sitios-dashboard/cliente', clienteData);
      await fetchData(); 
      setModalClienteOpen(false);
    } catch (error) {
      console.error("Error al guardar cliente:", error);
      throw error;
    }
  };

  // Filtrado local en el frontend
  // CORRECCIÓN: Protección (sitios || []) para evitar el error "undefined filter"
  const sitiosFiltrados = (sitios || []).filter(s => 
    s.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.ubicacion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
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
  );
}