import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src', 'pages');

const filesToProcess = [
  'CalendarView.jsx',
  'CrmView.jsx',
  'EgresosView.jsx',
  'HomeDashboard.jsx',
  'HonorariosVariablesView.jsx',
  'IngresosView.jsx',
  'UsersView.jsx'
];

filesToProcess.forEach(fileName => {
  const filePath = path.join(pagesDir, fileName);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // 1. Reduce root vertical spacing from space-y-6 to space-y-4
    content = content.replace(/space-y-6/g, 'space-y-3');

    // 2. Reduce header paddings
    content = content.replace(/pb-5 shrink-0/g, 'pb-3 shrink-0');
    content = content.replace(/pb-6 shrink-0/g, 'pb-3 shrink-0');

    // 3. Reduce header font sizes
    content = content.replace(/text-3xl font-black/g, 'text-2xl font-black');
    content = content.replace(/text-2xl font-black/g, 'text-xl font-black'); // For those already 2xl
    
    // 4. Reduce subtitle sizes
    content = content.replace(/text-sm mt-1/g, 'text-xs mt-0.5');
    content = content.replace(/text-sm font-medium/g, 'text-xs font-medium');

    // 5. Optionally reduce padding on search/action inputs
    content = content.replace(/py-2\.5 rounded-xl/g, 'py-2 rounded-xl');
    content = content.replace(/py-3 rounded-xl/g, 'py-2 rounded-xl');

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Optimized UI scale in ${fileName}`);
  }
});
