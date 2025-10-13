// scripts/create-feature.js
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

// --- Helper Functions ---
const toPascalCase = (str) => str.replace(/(^\w|-\w)/g, (c) => c.replace('-', '').toUpperCase());
const toKebabCase = (str) => str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
const escapeSql = (str) => (str ? `'${str.replace(/'/g, "''")}'` : 'NULL');

// --- Main Script ---
async function main() {
  console.log('🚀 Iniciando asistente para crear nueva funcionalidad...');

  const answers = await inquirer.prompt([
    { type: 'input', name: 'featureName', message: 'Nombre visible de la función (ej. Reportes de Finanzas):' },
    { type: 'input', name: 'route', message: 'Ruta de la URL (ej. /reportes/finanzas):' },
    { type: 'input', name: 'module', message: 'Módulo o grupo del sidebar (ej. Reportes):' },
    { type: 'input', name: 'icon', message: 'Nombre del Ícono de Material-UI (ej. Assessment):' },
    { type: 'input', name: 'code', message: 'Código/Permiso único (ej. REP_FINANZAS):' },
  ]);

  const { featureName, route, module, icon, code } = answers;
  if (!featureName || !route || !module || !icon || !code) {
    console.error('❌ Todos los campos son obligatorios. Abortando.');
    return;
  }

  const componentName = toPascalCase(featureName.replace(/ /g, '-'));
  const componentFolder = toKebabCase(module);
  const branchName = `feature/${toKebabCase(featureName)}`;

  // --- 1. Generar Archivo de Migración ---
  const timestamp = Date.now();
  const migrationFileName = `${timestamp}_agregar-funcion-${toKebabCase(code)}.js`;
  const migrationPath = path.join('backend', 'migrations', migrationFileName);
  const migrationContent = `
/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = async (pgm) => {
  const code = ${escapeSql(code)};
  const nombre = ${escapeSql(featureName)};
  const modulo = ${escapeSql(module)};
  const icono = ${escapeSql(icon)};
  const ruta = ${escapeSql(route)};

  await pgm.sql(\`
    INSERT INTO public.funciones (codigo, nombre, modulo, icono, ruta)
    VALUES (\${code}, \${nombre}, \${modulo}, \${icono}, \${ruta})
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      modulo = EXCLUDED.modulo,
      icono = EXCLUDED.icono,
      ruta = EXCLUDED.ruta;
  \`);
  
  // Opcional: Asignar a un rol por defecto, ej. Superusuario.
  // const rolIdSuperusuario = '(SELECT id FROM roles WHERE codigo = \'TI\')';
  // const funcionId = \`(SELECT id FROM funciones WHERE codigo = \${code})\`;
  // await pgm.sql(\`INSERT INTO rol_funcion (rol_id, funcion_id) VALUES (\${rolIdSuperusuario}, \${funcionId}) ON CONFLICT DO NOTHING;\`);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = async (pgm) => {
  const code = ${escapeSql(code)};
  await pgm.sql(\`DELETE FROM public.funciones WHERE codigo = \${code};\`);
};
`;
  await fs.writeFile(migrationPath, migrationContent);
  console.log(`✅ Migración creada: ${migrationPath}`);

  // --- 2. Generar Archivos del Frontend ---
  const pageTemplate = await fs.readFile(path.join('scripts', 'templates', 'Page.jsx.template'), 'utf-8');
  const componentTemplate = await fs.readFile(path.join('scripts', 'templates', 'Component.jsx.template'), 'utf-8');

  const pageContent = pageTemplate.replace(/{{ComponentName}}/g, componentName).replace(/{{FeatureName}}/g, featureName).replace(/{{ComponentFolder}}/g, componentFolder);
  const componentContent = componentTemplate.replace(/{{ComponentName}}/g, componentName).replace(/{{FeatureName}}/g, featureName).replace(/{{ComponentFolder}}/g, componentFolder);

  const componentDirPath = path.join('sira-front', 'src', 'components', componentFolder);
  await fs.ensureDir(componentDirPath);

  const pagePath = path.join('sira-front', 'src', 'pages', `${componentName}Page.jsx`);
  const componentPath = path.join(componentDirPath, `${componentName}.jsx`);

  await fs.writeFile(pagePath, pageContent);
  console.log(`✅ Página creada: ${pagePath}`);
  await fs.writeFile(componentPath, componentContent);
  console.log(`✅ Componente creado: ${componentPath}`);

  // --- 3. Automatizar Git ---
  console.log('🔄 Automatizando Git...');
  try {
    execSync(`git checkout -b ${branchName}`);
    console.log(`✅ Rama creada y seleccionada: ${branchName}`);
    execSync('git add .');
    console.log('✅ Nuevos archivos añadidos al stage.');
    execSync(`git commit -m "feat: scaffold para la funcionalidad '${featureName}'"`);
    console.log('✅ Commit inicial realizado.');
  } catch (error) {
    console.error('❌ Error durante la automatización de Git:', error.message);
  }

  console.log('\n🎉 ¡Proceso completado! Próximos pasos:');
  console.log('   1. Revisa los nuevos archivos y la migración.');
  console.log('   2. Ve a la carpeta `backend` y corre `npm run migrate up`.');
  console.log('   3. Importa y configura la nueva ruta en tu `App.jsx`.');
  console.log(`   4. Empieza a desarrollar en la rama '${branchName}'.`);
  console.log('   5. No olvides agregar el ícono nuevo al `iconMap` en `Sidebar.jsx`.');
}

main();