//C:\SIRA\sira-front\src\components\-p-m-o\Sitios.jsx
import React, { useState, useEffect } from 'react';
// Corrección: Apuntar al nombre de archivo específico creado por el usuario 'sitios_kpi.jsx'
import KPISitios from './sitios/sitios_kpi.jsx';
// Corrección: Agregar extensiones .jsx explícitas para asegurar la resolución
import FiltrosSitios from './sitios/FiltrosSitios.jsx';
import TablaSitios from './sitios/TablaSitios.jsx';
import ModalNuevoSitio from './sitios/ModalNuevoSitio.jsx';
import ModalNuevoCliente from './sitios/ModalNuevoCliente.jsx';
import { api } from '../../api/api.js';

export default function Sitios() {
  const [loading, setLoading] = useState(true);
  const [sitios, setSitios] = useState([]);
  const [kpiData, setKpiData] = useState({});
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para Modales
  const [modalSitioOpen, setModalSitioOpen] = useState(false);
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [sitioAEditar, setSitioAEditar] = useState(null);

  // Función para cargar todos los datos
  const fetchData = async () => {
    setLoading(true);
    try {
      // Cargamos KPIs y Listado en paralelo para mayor velocidad
      const [kpisRes, sitiosRes] = await Promise.all([
        api.get('/sitios-dashboard/kpis').catch(err => { console.error("Error KPIs", err); return { data: {} }; }),
        api.get('/sitios-dashboard').catch(err => { console.error("Error Sitios", err); return { data: [] }; })
      ]);
      
      setKpiData(kpisRes.data);
      setSitios(Array.isArray(sitiosRes.data) ? sitiosRes.data : []);
    } catch (error) {
      console.error("Error general cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lógica de Filtrado en el cliente
  const sitiosFiltrados = sitios.filter(s => {
    const term = busqueda.toLowerCase();
    return (
      (s.nombre && s.nombre.toLowerCase().includes(term)) ||
      (s.cliente_nombre && s.cliente_nombre.toLowerCase().includes(term)) ||
      (s.ubicacion && s.ubicacion.toLowerCase().includes(term))
    );
  });

  // Handlers para guardar datos (se pasan a los modales)
  const handleGuardarSitio = async (datosSitio) => {
    // Si tiene ID es edición (PUT), si no es creación (POST)
    // Nota: El backend actual solo configuramos POST, si necesitas editar habría que añadir PUT al backend.
    // Por ahora trataremos todo como POST para creación según lo acordado.
    await api.post('/sitios-dashboard', datosSitio);
    fetchData(); // Recargamos la tabla y KPIs
  };

  const handleGuardarCliente = async (datosCliente) => {
    await api.post('/sitios-dashboard/cliente', datosCliente);
    // Recargamos para actualizar el contador de clientes en KPIs
    // y opcionalmente podríamos recargar el select del modal de sitios si estuviera abierto
    fetchData(); 
  };

  const handleVerProyectos = (sitio) => {
    // Aquí puedes redirigir a una página de detalles o abrir otro modal
    console.log("Navegar a proyectos del sitio:", sitio.nombre);
    // Ejemplo: navigate(`/proyectos?sitio=${sitio.id}`);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Sitios</h1>
          <p className="text-gray-500 mt-2">
            Administra las ubicaciones y clientes de tus proyectos.
          </p>
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
          onVerProyectos={handleVerProyectos}
          onEditar={(sitio) => { setSitioAEditar(sitio); setModalSitioOpen(true); }}
        />

        {/* Modales */}
        <ModalNuevoSitio 
          isOpen={modalSitioOpen}
          onClose={() => setModalSitioOpen(false)}
          onSave={handleGuardarSitio}
          sitioEditar={sitioAEditar}
        />

        <ModalNuevoCliente
          isOpen={modalClienteOpen}
          onClose={() => setModalClienteOpen(false)}
          onSave={handleGuardarCliente}
        />
      </div>
    </div>
  );
}