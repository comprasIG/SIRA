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

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);

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
          onClick={() => alert('Acción: Agregar nuevo proveedor')}
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
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
          <div>
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
          <div>
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
          <div>
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
          <div>
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
          <div className="md:col-span-5 flex flex-wrap gap-3 justify-end">
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
    </div>
  );
}
