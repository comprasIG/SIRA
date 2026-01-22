// src/components/-compras/Proveedores.jsx
import { useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorefrontIcon from '@mui/icons-material/Storefront';
import api from '../../api/api';

const initialFilters = {
  search: '',
  marca: '',
  razon_social: '',
  rfc: '',
  contacto: '',
};

const initialProveedorForm = {
  marca: '',
  razon_social: '',
  rfc: '',
  contacto: '',
  telefono: '',
  correo: '',
  direccion: '',
  web: '',
  comentarios: '',
  dias_credito: '',
  whatsapp_notificaciones: '',
  correo_notificaciones: '',
};

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [showModal, setShowModal] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState(initialProveedorForm);

  const fetchProveedores = async (payload = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const query = params.toString();
      const data = await api.get(`/api/proveedores/list${query ? `?${query}` : ''}`);
      setProveedores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el directorio de proveedores.');
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchProveedores(filters);
  };

  const handleClear = () => {
    setFilters(initialFilters);
    fetchProveedores(initialFilters);
  };

  const handleOpenModal = () => {
    setNuevoProveedor(initialProveedorForm);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleProveedorChange = (event) => {
    const { name, value } = event.target;
    setNuevoProveedor((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuardarProveedor = (event) => {
    event.preventDefault();
    alert(`Acción: Guardar proveedor ${nuevoProveedor.marca}`);
    handleCloseModal();
  };

  const isFormValid = Boolean(
    nuevoProveedor.marca.trim()
      && nuevoProveedor.razon_social.trim()
      && nuevoProveedor.rfc.trim()
  );

  const totalProveedores = proveedores.length;

  const proveedoresVisibles = useMemo(() => proveedores, [proveedores]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Directorio de Proveedores</h2>
          <p className="text-gray-500 text-sm">Consulta, filtra y administra proveedores activos.</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
          onClick={handleOpenModal}
        >
          <AddIcon sx={{ fontSize: 20 }} />
          Nuevo proveedor
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
            <StorefrontIcon sx={{ fontSize: 24 }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total proveedores</p>
            <p className="text-2xl font-bold text-gray-800">{totalProveedores}</p>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <FilterListIcon sx={{ fontSize: 22 }} />
          <h3 className="text-lg font-semibold">Filtros de búsqueda</h3>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-nowrap gap-4 items-end overflow-x-auto">
          <div className="min-w-[220px]">
            <label className="text-sm text-gray-600">Búsqueda general</label>
            <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <SearchIcon sx={{ fontSize: 18, color: '#6b7280' }} />
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleChange}
                placeholder="Marca, RFC, contacto..."
                className="w-full outline-none text-sm"
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm text-gray-600">Marca</label>
            <input
              type="text"
              name="marca"
              value={filters.marca}
              onChange={handleChange}
              placeholder="Marca"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm text-gray-600">Razón social</label>
            <input
              type="text"
              name="razon_social"
              value={filters.razon_social}
              onChange={handleChange}
              placeholder="Razón social"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-sm text-gray-600">RFC</label>
            <input
              type="text"
              name="rfc"
              value={filters.rfc}
              onChange={handleChange}
              placeholder="RFC"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm text-gray-600">Contacto</label>
            <input
              type="text"
              name="contacto"
              value={filters.contacto}
              onChange={handleChange}
              placeholder="Contacto"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[220px] flex gap-3 justify-end ml-auto">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Buscar
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Vista de proveedores</h3>
            <p className="text-sm text-gray-500">{totalProveedores} registros encontrados</p>
          </div>
        </div>

        {loading && (
          <div className="py-8 text-center text-gray-500">Cargando proveedores...</div>
        )}
        {error && !loading && (
          <div className="py-8 text-center text-red-500">{error}</div>
        )}
        {!loading && !error && proveedoresVisibles.length === 0 && (
          <div className="py-8 text-center text-gray-500">No hay proveedores con los filtros seleccionados.</div>
        )}

        {!loading && !error && proveedoresVisibles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Marca</th>
                  <th className="text-left font-semibold px-4 py-3">Razón social</th>
                  <th className="text-left font-semibold px-4 py-3">RFC</th>
                  <th className="text-left font-semibold px-4 py-3">Contacto</th>
                  <th className="text-left font-semibold px-4 py-3">Teléfono</th>
                  <th className="text-left font-semibold px-4 py-3">Crédito</th>
                  <th className="text-right font-semibold px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proveedoresVisibles.map((prov) => (
                  <tr key={prov.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{prov.marca}</td>
                    <td className="px-4 py-3 text-gray-700">{prov.razon_social}</td>
                    <td className="px-4 py-3 text-gray-700">{prov.rfc}</td>
                    <td className="px-4 py-3 text-gray-700">{prov.contacto || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{prov.telefono || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{prov.dias_credito ? `${prov.dias_credito} días` : 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          onClick={() => alert(`Acción: Editar proveedor ${prov.marca}`)}
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Nuevo proveedor</h3>
                <p className="text-sm text-gray-500">Completa los campos obligatorios para registrar el proveedor.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarProveedor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Marca *</label>
                  <input
                    type="text"
                    name="marca"
                    required
                    value={nuevoProveedor.marca}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-600">Razón social *</label>
                  <input
                    type="text"
                    name="razon_social"
                    required
                    value={nuevoProveedor.razon_social}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">RFC *</label>
                  <input
                    type="text"
                    name="rfc"
                    required
                    value={nuevoProveedor.rfc}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Contacto</label>
                  <input
                    type="text"
                    name="contacto"
                    value={nuevoProveedor.contacto}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Teléfono</label>
                  <input
                    type="text"
                    name="telefono"
                    value={nuevoProveedor.telefono}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Correo</label>
                  <input
                    type="email"
                    name="correo"
                    value={nuevoProveedor.correo}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">WhatsApp notificaciones</label>
                  <input
                    type="text"
                    name="whatsapp_notificaciones"
                    value={nuevoProveedor.whatsapp_notificaciones}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Correo notificaciones</label>
                  <input
                    type="email"
                    name="correo_notificaciones"
                    value={nuevoProveedor.correo_notificaciones}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Días de crédito</label>
                  <input
                    type="number"
                    min="0"
                    name="dias_credito"
                    value={nuevoProveedor.dias_credito}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-sm text-gray-600">Dirección</label>
                  <input
                    type="text"
                    name="direccion"
                    value={nuevoProveedor.direccion}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-sm text-gray-600">Sitio web</label>
                  <input
                    type="text"
                    name="web"
                    value={nuevoProveedor.web}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-sm text-gray-600">Comentarios</label>
                  <textarea
                    name="comentarios"
                    rows="3"
                    value={nuevoProveedor.comentarios}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Guardar proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
