import { useG_OC } from '../hooks/useG_OC';
import { useOcPreview } from '../hooks/useOcPreview';
import KPISection from './G_OC/KPISection';
import FilterSection from './G_OC/FilterSection';
import OCList from './G_OC/OCList';
import OCInfoModal from './common/OCInfoModal';
import OcEditModal from './G_OC/OcEditModal';
import { Box, Typography } from '@mui/material';
import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/api';

export default function G_OCForm() {
  const {
    ocs,
    kpis,
    activeKpi,
    filters,
    options,
    loading,
    handleFilterChange,
    handleKpiClick,
    resetFilters,
    refresh
  } = useG_OC();

  const [editOc, setEditOc] = useState(null);

  const {
    previewOpen,
    previewOc,
    previewItems,
    previewMetadata,
    loading: previewLoading,
    openPreview,
    closePreview
  } = useOcPreview();

  const handleAction = async (action, oc) => {
    switch (action) {
      case 'info':
        openPreview(oc);
        break;
      case 'substitute':
        toast.info(`Sustituir OC: ${oc.numero_oc || oc.id} (Próximamente)`);
        break;
      case 'modify':
        setEditOc(oc);
        break;
      case 'pdf':
        handleDownloadPdf(oc);
        break;
      case 'cancel':
        handleCancelOc(oc);
        break;
      default:
        break;
    }
  };

  const handleDownloadPdf = async (oc) => {
    try {
      const response = await api.get(`/api/ocs/${oc.id}/pdf`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers?.get('content-disposition');
      let fileName = `OC-${oc.numero_oc || oc.id}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) fileName = match[1];
      }
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF descargado correctamente.');
    } catch (error) {
      console.error("Error downloading PDF", error);
      toast.error("Error al descargar el PDF.");
    }
  };

  const handleCancelOc = async (oc) => {
    const motivo = prompt("Ingrese el motivo de cancelación:");
    if (motivo === null) return;
    if (!motivo.trim()) {
      toast.warning("Debe ingresar un motivo.");
      return;
    }

    try {
      await api.post(`/api/finanzas/oc/${oc.id}/cancelar`, { motivo });
      toast.success('Orden de compra cancelada.');
      refresh();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al cancelar la OC.');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: '#1a237e' }}>
        Gestión de Órdenes de Compra
      </Typography>

      {/* KPI Section */}
      <KPISection kpis={kpis} activeKpi={activeKpi} onKpiClick={handleKpiClick} />

      {/* Filters Section */}
      <FilterSection
        filters={filters}
        options={options}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      {/* List Section */}
      <OCList
        ocs={ocs}
        loading={loading}
        onAction={handleAction}
      />

      {/* Info Modal */}
      {previewOc && (
        <OCInfoModal
          open={previewOpen}
          onClose={closePreview}
          oc={previewOc}
          items={previewItems}
          metadata={previewMetadata}
          loading={previewLoading}
        />
      )}

      {/* Edit Modal */}
      <OcEditModal
        open={Boolean(editOc)}
        oc={editOc}
        onClose={() => setEditOc(null)}
        onSuccess={() => { refresh(); setEditOc(null); }}
      />
    </Box>
  );
}
