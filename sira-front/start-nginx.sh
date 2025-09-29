#!/bin/sh

# Este script lee la plantilla, reemplaza la variable ${PORT} con el valor
# que nos da Cloud Run, y guarda el resultado en el archivo de configuración real.
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Finalmente, inicia NGINX para que sirva nuestra aplicación.
exec nginx -g 'daemon off;'