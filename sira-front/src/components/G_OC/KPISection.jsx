import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export default function KPISection({ kpis, activeKpi, onKpiClick }) {
    const cards = [
        { key: 'total', title: 'Total OCs', value: kpis.total || 0, icon: <AssignmentIcon />, color: '#B3E5FC' },
        { key: 'abiertas', title: 'Abiertas', value: kpis.abiertas || 0, icon: <AssignmentTurnedInIcon />, color: '#C8E6C9' },
        { key: 'porAutorizar', title: 'Por Autorizar', value: kpis.porAutorizar || 0, icon: <AssignmentLateIcon />, color: '#FFE0B2' },
        { key: 'entregadas', title: 'Entregadas', value: kpis.entregadas || 0, icon: <CheckCircleIcon />, color: '#E1BEE7' },
        { key: 'rechazadas', title: 'Rechazadas', value: kpis.rechazadas || 0, icon: <CancelIcon />, color: '#FFCDD2' },
    ];

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: 'repeat(auto-fit, minmax(180px, 1fr))',
                    sm: 'repeat(auto-fit, minmax(200px, 1fr))',
                    lg: 'repeat(auto-fit, minmax(240px, 1fr))',
                },
                gap: 2,
                mb: 3
            }}
        >
            {cards.map((card) => {
                const isActive = activeKpi === card.key;

                return (
                    <Paper
                        key={card.key}
                        elevation={isActive ? 6 : 2}
                        onClick={() => onKpiClick?.(card.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onKpiClick?.(card.key);
                            }
                        }}
                        sx={{
                            p: 1.25,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            minHeight: 88,
                            height: '100%',
                            borderLeft: `4px solid ${card.color}`,
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: isActive ? '0 0 0 2px rgba(26,35,126,0.35)' : undefined,
                            transform: isActive ? 'translateY(-2px)' : 'none',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: 'translateY(-3px)',
                                boxShadow: 4
                            }
                        }}
                    >
                        <Box sx={{ color: card.color, display: 'flex', alignItems: 'center' }}>
                            {React.cloneElement(card.icon, { fontSize: 'medium' })}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', color: '#333', lineHeight: 1 }}>
                                {card.value}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                {card.title}
                            </Typography>
                        </Box>
                    </Paper>
                );
            })}
        </Box>
    );
}

