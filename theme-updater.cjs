const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src', 'components');

const replacements = [
  // Backgrounds
  { regex: /bg-white/g, replacement: 'bg-zinc-900' },
  { regex: /bg-slate-50/g, replacement: 'bg-zinc-950' },
  { regex: /bg-slate-100\/50/g, replacement: 'bg-zinc-800/50' },
  { regex: /bg-slate-100/g, replacement: 'bg-zinc-800' },
  { regex: /bg-slate-200/g, replacement: 'bg-zinc-700' },
  
  // Text colors
  { regex: /text-slate-900/g, replacement: 'text-zinc-100' },
  { regex: /text-slate-800/g, replacement: 'text-zinc-200' },
  { regex: /text-slate-700/g, replacement: 'text-zinc-300' },
  { regex: /text-slate-600/g, replacement: 'text-zinc-400' },
  { regex: /text-slate-500/g, replacement: 'text-zinc-400' },
  { regex: /text-slate-400/g, replacement: 'text-zinc-500' },
  
  // Borders
  { regex: /border-slate-100/g, replacement: 'border-zinc-800' },
  { regex: /border-slate-200/g, replacement: 'border-zinc-800' },
  { regex: /border-slate-300/g, replacement: 'border-zinc-700' },
  { regex: /border-b/g, replacement: 'border-b border-zinc-800' }, // Be careful with this one, might duplicate
  
  // Hover states
  { regex: /hover:bg-slate-50/g, replacement: 'hover:bg-zinc-800/50' },
  { regex: /hover:bg-slate-100\/50/g, replacement: 'hover:bg-zinc-800/50' },
  { regex: /hover:bg-slate-100/g, replacement: 'hover:bg-zinc-800' },
  { regex: /hover:bg-slate-200/g, replacement: 'hover:bg-zinc-700' },
  
  // Rings
  { regex: /ring-slate-300/g, replacement: 'ring-zinc-700' },
  
  // Divide
  { regex: /divide-slate-200/g, replacement: 'divide-zinc-800' },
  
  // Specific Badge Colors
  { regex: /bg-emerald-100 text-emerald-800/g, replacement: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  { regex: /bg-blue-100 text-blue-800/g, replacement: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  { regex: /bg-amber-100 text-amber-800/g, replacement: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  { regex: /bg-red-100 text-red-800/g, replacement: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  { regex: /bg-blue-50 text-blue-700/g, replacement: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Fix the border-b duplication issue before applying
  content = content.replace(/border-b border-slate-200/g, 'border-b');
  content = content.replace(/border-b border-zinc-800/g, 'border-b');
  
  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });
  
  // Re-add border color to border-b if it doesn't have one
  content = content.replace(/border-b(?!\s+border-zinc)/g, 'border-b border-zinc-800');
  // Clean up any double border-zinc-800
  content = content.replace(/border-b border-zinc-800 border-zinc-800/g, 'border-b border-zinc-800');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

fs.readdirSync(directory).forEach(file => {
  if (file.endsWith('.tsx')) {
    processFile(path.join(directory, file));
  }
});
