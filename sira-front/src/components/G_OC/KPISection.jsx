
import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export default function KPISection({ kpis }) {
    const cards = [
        { title: 'Total OCs', value: kpis.total || 0, icon: <AssignmentIcon />, color: '#B3E5FC' }, // Pastel Blue
        { title: 'Abiertas', value: kpis.abiertas || 0, icon: <AssignmentTurnedInIcon />, color: '#C8E6C9' }, // Pastel Green
        { title: 'Por Autorizar', value: kpis.porAutorizar || 0, icon: <AssignmentLateIcon />, color: '#FFE0B2' }, // Pastel Orange
        { title: 'Entregadas', value: kpis.entregadas || 0, icon: <CheckCircleIcon />, color: '#E1BEE7' }, // Pastel Purple
        { title: 'Rechazadas', value: kpis.rechazadas || 0, icon: <CancelIcon />, color: '#FFCDD2' }, // Pastel Red
    ];

    return (
        <Grid container spacing={3} sx={{ mb: 3 }}>
            {cards.map((card, index) => (
                <Grid item xs={6} sm={4} md={2.4} key={index}>
                    <Paper
                        elevation={2}
                        sx={{
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            borderLeft: `5px solid ${card.color}`,
                            transition: 'transform 0.2s',
                            '&:hover': {
                                transform: 'translateY(-5px)',
                                boxShadow: 4
                            }
                        }}
                    >
                        <Box sx={{ color: card.color, mb: 1 }}>
                            {React.cloneElement(card.icon, { fontSize: 'large' })}
                        </Box>
                        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#333' }}>
                            {card.value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {card.title}
                        </Typography>
                    </Paper>
                </Grid>
            ))}
        </Grid>
    );
}
