import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';

/**
 * KPI cards for the Proyectos tab — polished, colorful, with subtle hover animation.
 */

const kpiCardStyles = [
    { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' },
    { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: '#1a3c34' },
    { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: '#4a1942' },
    { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', color: '#3d2352' },
];

export default function ProyectosKpiRow({ kpis }) {
    const items = [
        { label: 'Total Proyectos', value: kpis.total || 0 },
        { label: 'En Ejecución', value: kpis.enEjecucion || 0 },
        { label: 'Por Aprobar', value: kpis.porAprobar || 0 },
        { label: 'Cerrados', value: kpis.cerrados || 0 },
    ];

    return (
        <Grid container spacing={2} sx={{ mb: 1 }}>
            {items.map((item, idx) => {
                const style = kpiCardStyles[idx % kpiCardStyles.length];
                return (
                    <Grid item xs={12} sm={6} md={3} key={item.label}>
                        <Card
                            sx={{
                                background: style.bg,
                                color: style.color,
                                borderRadius: 3,
                                border: 'none',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                                cursor: 'default',
                                '&:hover': {
                                    transform: 'translateY(-3px)',
                                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                                },
                            }}
                        >
                            <CardContent sx={{ py: 2.5, px: 3, '&:last-child': { pb: 2.5 } }}>
                                <Typography
                                    variant="caption"
                                    sx={{ opacity: 0.85, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.7rem' }}
                                >
                                    {item.label}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 0.5 }}>
                                    <Typography variant="h4" component="div" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                        {item.value}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                );
            })}
        </Grid>
    );
}
