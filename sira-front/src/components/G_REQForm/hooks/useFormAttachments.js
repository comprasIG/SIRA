// C:\SIRA\sira-front\src\components\G_REQForm\hooks\useFormAttachments.js
import { useState } from 'react';
import { toast } from 'react-toastify';

/**
 * Custom Hook to manage file attachments for the G_REQForm.
 * @param {Array} initialExistingFiles - Initial list of existing files for edit mode.
 * @returns {object} - States and handlers for managing attachments.
 */
export function useFormAttachments(initialExistingFiles = []) {
  const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);
  const [archivosExistentes, setArchivosExistentes] = useState(initialExistingFiles);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if ((archivosAdjuntos.length + archivosExistentes.length + files.length) > 5) {
      toast.warn("Puedes tener un máximo de 5 archivos en total.");
      return;
    }
    setArchivosAdjuntos(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (fileNameToRemove) => {
    setArchivosAdjuntos(prev => prev.filter(file => file.name !== fileNameToRemove));
  };

  const handleRemoveExistingFile = (fileIdToRemove) => {
    setArchivosExistentes(prev => prev.filter(file => file.id !== fileIdToRemove));
  };
  
  // Expose setArchivosExistentes to be used in the main component after fetching data in edit mode
  return {
    archivosAdjuntos,
    setArchivosAdjuntos,
    archivosExistentes,
    setArchivosExistentes,
    handleFileChange,
    handleRemoveFile,
    handleRemoveExistingFile,
  };
}