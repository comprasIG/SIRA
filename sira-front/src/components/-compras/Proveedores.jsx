// src/components/-compras/Proveedores.jsx
import { useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CloseIcon from '@mui/icons-material/Close';
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
  whatsapp_notificaciones: false,
  correo_notificaciones: false,
};

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProveedor, setActiveProveedor] = useState(null);
  const [formValues, setFormValues] = useState(initialProveedorForm);
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleOpenNew = () => {
    setActiveProveedor(null);
    setFormValues(initialProveedorForm);
    setSubmitError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (prov) => {
    setActiveProveedor(prov);
    setFormValues({
      ...initialProveedorForm,
      marca: prov.marca || '',
      razon_social: prov.razon_social || '',
      rfc: prov.rfc || '',
      contacto: prov.contacto || '',
      telefono: prov.telefono || '',
      correo: prov.correo || '',
      direccion: prov.direccion || '',
      web: prov.web || '',
      comentarios: prov.comentarios || '',
      dias_credito: prov.dias_credito ?? '',
      whatsapp_notificaciones: Boolean(prov.whatsapp_notificaciones),
      correo_notificaciones: Boolean(prov.correo_notificaciones),
    });
    setSubmitError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setModalOpen(false);
    setSubmitError('');
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmitProveedor = async (event) => {
    event.preventDefault();
    if (!formValues.marca.trim() || !formValues.razon_social.trim()) {
      setSubmitError('Marca y razón social son obligatorias.');
      return;
    }

    try {
      setSaving(true);
      setSubmitError('');
      const payload = {
        ...formValues,
        dias_credito: formValues.dias_credito === '' ? null : Number(formValues.dias_credito),
      };

      if (activeProveedor?.id) {
        await api.put(`/api/proveedores/${activeProveedor.id}`, payload);
      } else {
        await api.post('/api/proveedores', payload);
      }

      setModalOpen(false);
      fetchProveedores(filters);
    } catch (err) {
      console.error(err);
      setSubmitError(err?.error || 'No se pudo guardar el proveedor.');
    } finally {
      setSaving(false);
    }
  };

  const totalProveedores = proveedores.length;

  const proveedoresVisibles = useMemo(() => proveedores, [proveedores]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Compras</p>
          <h2 className="text-3xl font-semibold text-slate-900">Directorio de Proveedores</h2>
          <p className="text-slate-500 text-sm">Consulta, filtra y administra proveedores activos.</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700"
          onClick={handleOpenNew}
        >
          <AddIcon sx={{ fontSize: 20 }} />
          Nuevo proveedor
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <StorefrontIcon sx={{ fontSize: 24 }} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total proveedores</p>
            <p className="text-2xl font-semibold text-slate-900">{totalProveedores}</p>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <div className="flex items-center gap-2 mb-4 text-slate-700">
          <FilterListIcon sx={{ fontSize: 22 }} />
          <h3 className="text-lg font-semibold">Filtros de búsqueda</h3>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 overflow-x-auto pb-2 lg:flex-row lg:flex-nowrap lg:items-end"
        >
          <div className="min-w-[260px] flex-1">
            <label className="text-sm text-slate-600">Búsqueda general</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
              <SearchIcon sx={{ fontSize: 18, color: '#64748b' }} />
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleChange}
                placeholder="Marca, RFC, contacto..."
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm text-slate-600">Marca</label>
            <input
              type="text"
              name="marca"
              value={filters.marca}
              onChange={handleChange}
              placeholder="Marca"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-sm text-slate-600">Razón social</label>
            <input
              type="text"
              name="razon_social"
              value={filters.razon_social}
              onChange={handleChange}
              placeholder="Razón social"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-sm text-slate-600">RFC</label>
            <input
              type="text"
              name="rfc"
              value={filters.rfc}
              onChange={handleChange}
              placeholder="RFC"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-sm text-slate-600">Contacto</label>
            <input
              type="text"
              name="contacto"
              value={filters.contacto}
              onChange={handleChange}
              placeholder="Contacto"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
            />
          </div>
          <div className="min-w-[210px] flex gap-3 lg:justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Buscar
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Vista de proveedores</h3>
            <p className="text-sm text-slate-500">{totalProveedores} registros encontrados</p>
          </div>
        </div>

        {loading && (
          <div className="py-8 text-center text-slate-500">Cargando proveedores...</div>
        )}
        {error && !loading && (
          <div className="py-8 text-center text-red-500">{error}</div>
        )}
        {!loading && !error && proveedoresVisibles.length === 0 && (
          <div className="py-8 text-center text-slate-500">No hay proveedores con los filtros seleccionados.</div>
        )}

        {!loading && !error && proveedoresVisibles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
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
                    <td className="px-4 py-3 font-semibold text-slate-900">{prov.marca}</td>
                    <td className="px-4 py-3 text-slate-700">{prov.razon_social}</td>
                    <td className="px-4 py-3 text-slate-700">{prov.rfc}</td>
                    <td className="px-4 py-3 text-slate-700">{prov.contacto || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{prov.telefono || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{prov.dias_credito ? `${prov.dias_credito} días` : 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                          onClick={() => handleOpenEdit(prov)}
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

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {activeProveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
                </p>
                <h4 className="text-lg font-semibold text-slate-900">
                  {activeProveedor ? activeProveedor.marca : 'Registrar proveedor'}
                </h4>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                onClick={handleCloseModal}
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSubmitProveedor} className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">Marca *</label>
                  <input
                    type="text"
                    name="marca"
                    value={formValues.marca}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Razón social *</label>
                  <input
                    type="text"
                    name="razon_social"
                    value={formValues.razon_social}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">RFC</label>
                  <input
                    type="text"
                    name="rfc"
                    value={formValues.rfc}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Contacto</label>
                  <input
                    type="text"
                    name="contacto"
                    value={formValues.contacto}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Teléfono</label>
                  <input
                    type="text"
                    name="telefono"
                    value={formValues.telefono}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Correo</label>
                  <input
                    type="email"
                    name="correo"
                    value={formValues.correo}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Dirección</label>
                  <input
                    type="text"
                    name="direccion"
                    value={formValues.direccion}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Sitio web</label>
                  <input
                    type="url"
                    name="web"
                    value={formValues.web}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Días de crédito</label>
                  <input
                    type="number"
                    min="0"
                    name="dias_credito"
                    value={formValues.dias_credito}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="whatsapp_notificaciones"
                      checked={formValues.whatsapp_notificaciones}
                      onChange={handleFormChange}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="correo_notificaciones"
                      checked={formValues.correo_notificaciones}
                      onChange={handleFormChange}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    Correo
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-slate-600">Comentarios</label>
                  <textarea
                    name="comentarios"
                    value={formValues.comentarios}
                    onChange={handleFormChange}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                </div>
              </div>

              {submitError && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {submitError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
