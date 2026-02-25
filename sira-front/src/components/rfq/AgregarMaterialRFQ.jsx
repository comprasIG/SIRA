// C:\SIRA\sira-front\src\components\rfq\AgregarMaterialRFQ.jsx
/**
 * =================================================================================================
 * Componente: AgregarMaterialRFQ
 * Permite buscar y agregar materiales adicionales a una requisición desde G_RFQ.
 * Usa el mismo endpoint /api/materiales?query= con Autocomplete inteligente.
 * =================================================================================================
 */
import React, { useState, useEffect } from "react";
import {
    Paper, Typography, Autocomplete, TextField, Button, Box, IconButton,
    CircularProgress, Collapse,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { toast } from "react-toastify";
import api from "../../api/api";
import useDebounce from "./useDebounce";

export default function AgregarMaterialRFQ({ requisicionId, onMaterialAdded, disabled = false }) {
    const [expanded, setExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [materialesOptions, setMaterialesOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [cantidad, setCantidad] = useState("");
    const [saving, setSaving] = useState(false);

    const debouncedSearch = useDebounce(searchTerm, 500);

    // Buscar materiales con debounce
    useEffect(() => {
        if (!debouncedSearch) {
            setMaterialesOptions([]);
            return;
        }
        const buscar = async () => {
            setLoading(true);
            try {
                const data = await api.get(`/api/materiales?query=${encodeURIComponent(debouncedSearch)}`);
                setMaterialesOptions(data || []);
            } catch (err) {
                console.error("Error buscando materiales:", err);
                setMaterialesOptions([]);
            } finally {
                setLoading(false);
            }
        };
        buscar();
    }, [debouncedSearch]);

    const handleAgregar = async () => {
        if (!selectedMaterial || !cantidad || Number(cantidad) <= 0) {
            toast.warn("Selecciona un material e ingresa una cantidad válida.");
            return;
        }

        setSaving(true);
        try {
            const result = await api.post(`/api/rfq/${requisicionId}/materiales-adicionales`, {
                material_id: selectedMaterial.id,
                cantidad: Number(cantidad),
            });
            toast.success(result.mensaje || "Material agregado correctamente.");
            // Limpiar formulario
            setSelectedMaterial(null);
            setCantidad("");
            setSearchTerm("");
            setMaterialesOptions([]);
            // Notificar al padre para refrescar
            if (onMaterialAdded) onMaterialAdded();
        } catch (err) {
            const errorMsg = err?.error || err?.message || "Error al agregar el material.";
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Paper
            elevation={1}
            sx={{
                p: 2,
                mt: 2,
                borderRadius: 2,
                border: "2px dashed",
                borderColor: expanded ? "primary.main" : "grey.300",
                bgcolor: expanded ? "primary.50" : "grey.50",
                transition: "all 0.3s ease",
            }}
        >
            {/* Toggle Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                }}
                onClick={() => !disabled && setExpanded((p) => !p)}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AddCircleOutlineIcon color={expanded ? "primary" : "action"} />
                    <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: "bold", color: expanded ? "primary.main" : "text.secondary" }}
                    >
                        Agregar Material Adicional
                    </Typography>
                </Box>
                <IconButton size="small" disabled={disabled}>
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </Box>

            {/* Collapsible Form */}
            <Collapse in={expanded}>
                <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* Autocomplete de Material */}
                    <Autocomplete
                        options={materialesOptions}
                        getOptionLabel={(option) =>
                            option ? `${option.sku} - ${option.nombre}` : ""
                        }
                        filterOptions={(x) => x}
                        loading={loading}
                        onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
                        onChange={(_, value) => setSelectedMaterial(value)}
                        value={selectedMaterial}
                        isOptionEqualToValue={(option, val) =>
                            option && val && option.id === val.id
                        }
                        renderOption={(props, option, state) => (
                            <li
                                {...props}
                                key={option.id}
                                className={`${props.className} ${state.index % 2 === 0 ? "bg-gray-50" : "bg-white"
                                    }`}
                            >
                                <div className="flex flex-col">
                                    <div>
                                        <span className="font-bold mr-2">{option.sku}</span>
                                        <span>- {option.nombre}</span>
                                    </div>
                                </div>
                            </li>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Buscar Material por SKU o Nombre"
                                variant="outlined"
                                size="small"
                                placeholder="Escribe para buscar..."
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {loading ? <CircularProgress size={18} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        disabled={disabled || saving}
                    />

                    {/* Cantidad + Botón */}
                    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                        <TextField
                            label="Cantidad"
                            type="number"
                            size="small"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            inputProps={{ min: 0.0001, step: "0.01" }}
                            sx={{ width: 160 }}
                            disabled={disabled || saving}
                        />
                        <Button
                            variant="contained"
                            startIcon={
                                saving ? <CircularProgress size={18} color="inherit" /> : <AddCircleOutlineIcon />
                            }
                            onClick={handleAgregar}
                            disabled={disabled || saving || !selectedMaterial || !cantidad}
                            sx={{ minWidth: 140 }}
                        >
                            {saving ? "Agregando..." : "Agregar"}
                        </Button>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                        El material se agregará a esta requisición con tu usuario como responsable.
                        No se puede agregar un material que ya exista en la requisición.
                    </Typography>
                </Box>
            </Collapse>
        </Paper>
    );
}
