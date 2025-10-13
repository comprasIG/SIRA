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
  console.log('🚀 Asistente para crear nueva funcionalidad...');

  const answers = await inquirer.prompt([
    { type: 'input', name: 'featureName', message: 'Nombre visible de la función (ej. Salida de Almacén):' },
    { type: 'input', name: 'route', message: 'Ruta URL (ej. /salida-almacen):' },
    { type: 'input', name: 'module', message: 'Módulo o grupo del sidebar (ej. Almacen):' },
    { type: 'input', name: 'code', message: 'Código/Permiso único (ej. ALM_SALIDA):' },
    { type: 'input', name: 'icon', message: 'Ícono de Material-UI (o presiona Enter para usar el default):', default: 'HelpOutline' },
  ]);

  const { featureName, route, module, icon, code } = answers;
  if (!featureName || !route || !module || !code) {
    console.error('❌ Los primeros 4 campos son obligatorios. Abortando.');
    return;
  }

  // --- Preparación de Nombres y Rutas ---
  const componentName = toPascalCase(featureName.replace(/ /g, '-'));
  const componentFolder = toKebabCase(module);
  const branchName = `feature/${featureName.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '')}`;

  const filesCreated = []; // Registro de archivos creados para poder borrarlos si algo falla

  try {
    // --- 1. Generar Migración ---
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
  await pgm.sql(\`INSERT INTO public.funciones (codigo, nombre, modulo, icono, ruta) VALUES (\${code}, \${nombre}, \${modulo}, \${icono}, \${ruta}) ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, modulo = EXCLUDED.modulo, icono = EXCLUDED.icono, ruta = EXCLUDED.ruta;\`);
};
/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = async (pgm) => {
  const code = ${escapeSql(code)};
  await pgm.sql(\`DELETE FROM public.funciones WHERE codigo = \${code};\`);
};
`;
    await fs.writeFile(migrationPath, migrationContent);
    filesCreated.push(migrationPath);
    console.log(`✅ Migración creada: ${migrationPath}`);

    // --- 2. Ejecutar Migración ---
    console.log('🔄 Ejecutando migración en el backend...');
    execSync('npm run migrate up', { cwd: './backend', stdio: 'inherit' });
    console.log('✅ Migración aplicada exitosamente.');

    // --- 3. Generar Archivos del Frontend ---
    const pageTemplate = await fs.readFile(path.join('scripts', 'templates', 'Page.jsx.template'), 'utf-8');
    const componentTemplate = await fs.readFile(path.join('scripts', 'templates', 'Component.jsx.template'), 'utf-8');
    
    const pageContent = pageTemplate.replace(/{{ComponentName}}/g, componentName).replace(/{{FeatureName}}/g, featureName).replace(/{{ComponentFolder}}/g, componentFolder);
    const componentContent = componentTemplate.replace(/{{ComponentName}}/g, componentName).replace(/{{FeatureName}}/g, featureName).replace(/{{ComponentFolder}}/g, componentFolder);

    const componentDirPath = path.join('sira-front', 'src', 'components', componentFolder);
    await fs.ensureDir(componentDirPath);
    
    const pagePath = path.join('sira-front', 'src', 'pages', `${componentName}Page.jsx`);
    const componentPath = path.join(componentDirPath, `${componentName}.jsx`);

    await fs.writeFile(pagePath, pageContent);
    filesCreated.push(pagePath);
    console.log(`✅ Página creada: ${pagePath}`);
    await fs.writeFile(componentPath, componentContent);
    filesCreated.push(componentPath);
    console.log(`✅ Componente creado: ${componentPath}`);

    // --- 4. Modificar App.jsx ---
    console.log('🔄 Modificando App.jsx para añadir la nueva ruta...');
    const appPath = path.join('sira-front', 'src', 'App.jsx');
    let appContent = await fs.readFile(appPath, 'utf-8');
    const routeMarker = '{/* --- AÑADIR NUEVAS RUTAS AUTOMÁTICAMENTE AQUÍ --- */}';
    const newRoute = `          <Route path="${route}" element={<RutaProtegida permiso="${code}"><MainLayout><${componentName}Page /></MainLayout></RutaProtegida>}/>`;
    
    if (appContent.includes(routeMarker)) {
      appContent = appContent.replace(routeMarker, `${newRoute}\n          ${routeMarker}`);
      appContent = `import ${componentName}Page from "./pages/${componentName}Page";\n` + appContent;
      await fs.writeFile(appPath, appContent);
      console.log('✅ Ruta añadida a App.jsx exitosamente.');
    } else {
      throw new Error(`No se encontró el marcador de ruta en App.jsx: ${routeMarker}`);
    }

    // --- 5. Automatizar Git ---
    console.log('🔄 Automatizando Git...');
    execSync(`git checkout -b ${branchName}`);
    console.log(`✅ Rama creada y seleccionada: ${branchName}`);
    execSync('git add .');
    console.log('✅ Nuevos archivos añadidos al stage.');
    execSync(`git commit -m "feat: scaffold para la funcionalidad '${featureName}'"`);
    console.log('✅ Commit inicial realizado.');

    // --- Mensaje Final ---
    console.log('\n🎉 ¡Proceso completado! La nueva funcionalidad está lista para desarrollar.');
    console.log(`   - Tu nueva rama es: ${branchName}`);
    console.log('   - El enlace ya debería aparecer en el Sidebar (para los roles con permiso).');
    if (icon === 'HelpOutline') {
      console.log('   - 🟡 Recuerda cambiar el ícono por defecto en la BD y agregarlo al `Sidebar.jsx`.');
    }

  } catch (error) {
    console.error('❌ ¡Oh no! Algo salió mal durante el proceso.');
    console.error(error.message);

    // --- Lógica de Reversión (Rollback) ---
    console.log('🔄 Revirtiendo cambios...');
    if (filesCreated.length > 0) {
      for (const file of filesCreated) {
        try {
          await fs.remove(file);
          console.log(`   - Archivo eliminado: ${file}`);
        } catch (rmError) {
          console.error(`   - Error al eliminar ${file}:`, rmError.message);
        }
      }
    }
    // Nota: La migración de BD no se revierte automáticamente aquí,
    // pero como es idempotente, no causará problemas.
    console.log('🔥 Reversión completada. Tu proyecto está limpio.');
  }
}

main();