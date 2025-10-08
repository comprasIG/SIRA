// src/components/REC_OC/REC_OCForm.jsx
import React, { useState } from 'react';
import { Container, Box, Typography } from '@mui/material';
import RecOcKPIs from './RecOcKPIs';
import RecOcFilters from './RecOcFilters';
import RecOcTable from './RecOcTable';
import RecOcMethodModal from './RecOcMethodModal';
import RecOcNotifyModal from './RecOcNotifyModal';
import RecOcFilesModal from './RecOcFilesModal';
import RecOcHistoryModal from './RecOcHistoryModal';
import RecOcCancelModal from './RecOcCancelModal';

export default function REC_OCForm() {
  const [filtros, setFiltros] = useState({});
  const [reload, setReload] = useState(0);
  const bump = () => setReload(r => r + 1);

  const [selected, setSelected] = useState(null);
  const [openMethod, setOpenMethod] = useState(false);
  const [openNotify, setOpenNotify] = useState(false);
  const [openFiles, setOpenFiles] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Recolección de Órdenes de Compra
      </Typography>

      <RecOcKPIs onCancelarClick={() => setOpenCancel(true)} reload={reload} />

      <Box mt={2}>
        <RecOcFilters onChange={setFiltros} />
      </Box>

      <Box mt={2}>
        <RecOcTable
          filtros={filtros}
          reload={reload}
          onMetodo={(row)=>{ setSelected(row); setOpenMethod(true); }}
          onNotificar={(row)=>{ setSelected(row); setOpenNotify(true); }}
          onArchivos={(row)=>{ setSelected(row); setOpenFiles(true); }}
          onHistorial={(row)=>{ setSelected(row); setOpenHistory(true); }}
        />
      </Box>

      {/* Modales */}
      <RecOcMethodModal
        open={openMethod}
        onClose={()=>setOpenMethod(false)}
        oc={selected}
        onSaved={()=>{ setOpenMethod(false); bump(); }}
      />
      <RecOcNotifyModal
        open={openNotify}
        onClose={()=>setOpenNotify(false)}
        oc={selected}
        onSent={()=>{ setOpenNotify(false); bump(); }}
      />
      <RecOcFilesModal
        open={openFiles}
        onClose={()=>setOpenFiles(false)}
        oc={selected}
        onUploaded={()=>{ setOpenFiles(false); bump(); }}
      />
      <RecOcHistoryModal
        open={openHistory}
        onClose={()=>setOpenHistory(false)}
        oc={selected}
      />
      <RecOcCancelModal
        open={openCancel}
        onClose={()=>setOpenCancel(false)}
        onCanceled={()=>{ setOpenCancel(false); bump(); }}
      />
    </Container>
  );
}
