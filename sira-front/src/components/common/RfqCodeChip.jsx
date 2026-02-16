import React from 'react';
import { Chip } from '@mui/material';
import { keyframes } from '@mui/system';

/**
 * RfqCodeChip — Chip estilizado para mostrar códigos de RFQ/Requisición.
 * Animación de hover sutil e Instagram-inspired con tonos pastel:
 * - Gradiente de borde que rota suavemente
 * - Escala ligeramente al pasar el mouse
 * - Transición suave en todos los estados
 */

const borderGlow = keyframes`
  0%   { border-color: #E8A0BF; box-shadow: 0 0 0 0 rgba(232,160,191,0.0); }
  25%  { border-color: #BA90C6; box-shadow: 0 0 6px 1px rgba(186,144,198,0.15); }
  50%  { border-color: #C0DBEA; box-shadow: 0 0 6px 1px rgba(192,219,234,0.15); }
  75%  { border-color: #E8D5B7; box-shadow: 0 0 6px 1px rgba(232,213,183,0.15); }
  100% { border-color: #E8A0BF; box-shadow: 0 0 0 0 rgba(232,160,191,0.0); }
`;

export default function RfqCodeChip({ label, onClick }) {
    return (
        <Chip
            label={label}
            onClick={onClick}
            variant="outlined"
            size="small"
            sx={{
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: 0.3,
                cursor: 'pointer',
                borderWidth: 1.5,
                borderColor: '#d0d0d0',
                backgroundColor: '#fafafa',
                color: '#444',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                '&:hover': {
                    transform: 'scale(1.06)',
                    backgroundColor: '#fff',
                    color: '#333',
                    borderWidth: 1.5,
                    animation: `${borderGlow} 2.5s ease infinite`,
                },
            }}
        />
    );
}
