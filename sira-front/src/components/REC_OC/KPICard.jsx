// sira-front/src/components/REC_OC/KPICard.jsx
import React from 'react';
import { Paper, Stack, Typography, Box } from '@mui/material';
import { alpha, lighten, useTheme } from '@mui/material/styles';

const resolveColor = (theme, colorProp) => {
  if (!colorProp) {
    return theme.palette.primary.main;
  }

  if (typeof colorProp === 'string' && colorProp.includes('.')) {
    const [paletteKey, shadeKey] = colorProp.split('.');
    const paletteSection = theme.palette[paletteKey];
    if (paletteSection && paletteSection[shadeKey]) {
      return paletteSection[shadeKey];
    }
  }

  const paletteColor = theme.palette[colorProp];
  if (paletteColor?.main) {
    return paletteColor.main;
  }

  return colorProp;
};

export default function KPICard({ title, value = 0, icon, color, comment, onClick, active = false, sx = {} }) {
  const theme = useTheme();
  const baseColor = resolveColor(theme, color);
  const accentColor = active ? baseColor : lighten(baseColor, 0.2);
  const glowColor = alpha(baseColor, active ? 0.25 : 0.15);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 3,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        border: `1px solid ${alpha(baseColor, active ? 0.35 : 0.12)}`,
        backgroundImage: `linear-gradient(135deg, ${alpha(baseColor, active ? 0.18 : 0.08)} 0%, ${alpha(baseColor, active ? 0.04 : 0.02)} 100%)`,
        boxShadow: active
          ? `0 12px 30px ${alpha(baseColor, 0.28)}`
          : `0 6px 18px ${glowColor}`,
        transform: active ? 'translateY(-4px)' : 'none',
        '&:hover': onClick
          ? {
              boxShadow: `0 16px 32px ${alpha(baseColor, 0.32)}`,
              transform: 'translateY(-4px)',
              borderColor: alpha(baseColor, 0.4),
            }
          : undefined,
        ...sx,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `linear-gradient(135deg, ${alpha(baseColor, active ? 0.28 : 0.2)} 0%, ${alpha(baseColor, active ? 0.12 : 0.08)} 100%)`,
            color: theme.palette.getContrastText(accentColor),
            boxShadow: `0 8px 18px ${alpha(baseColor, 0.25)}`,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="overline" color={active ? baseColor : 'text.secondary'} sx={{ letterSpacing: 0.6 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} color="text.primary">
            {value}
          </Typography>
          {comment && (
            <Typography variant="caption" color="text.secondary">
              {comment}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}