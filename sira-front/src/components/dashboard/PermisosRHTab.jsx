import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { keyframes } from '@mui/system';
import ConstructionIcon from '@mui/icons-material/Construction';

const bounce = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25%      { transform: translateY(-6px) rotate(-5deg); }
  75%      { transform: translateY(-3px) rotate(5deg); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

/**
 * Placeholder tab for Permisos RH — polished 'under construction' design.
 */
export default function PermisosRHTab() {
    return (
        <Paper
            sx={{
                p: 6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                background: 'linear-gradient(135deg, rgba(250,247,255,1) 0%, rgba(245,240,255,0.5) 100%)',
            }}
        >
            <Box
                sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                    mb: 3,
                    boxShadow: '0 4px 15px rgba(252, 182, 159, 0.3)',
                }}
            >
                <ConstructionIcon
                    sx={{
                        fontSize: 40,
                        color: '#e17055',
                        animation: `${bounce} 2s ease-in-out infinite`,
                    }}
                />
            </Box>

            <Typography
                variant="h5"
                sx={{
                    fontWeight: 800,
                    mb: 1,
                    background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb, #667eea)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: `${shimmer} 3s linear infinite`,
                }}
            >
                Permisos y Vacaciones RH
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                Este módulo está en construcción
            </Typography>

            <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
                Próximamente disponible
            </Typography>
        </Paper>
    );
}
