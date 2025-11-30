const fs = require('fs');
const path = require('path');
const { parseDocument } = require('htmlparser2');

const distDir = './dist';
let processed = 0;
let modified = 0;
let skippedNone = 0;
let skippedExists = 0;

function getAllAstroFiles(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getAllAstroFiles(fullPath));
    } else if (item.endsWith('.astro')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findSvgElement(node) {
  if (node.type === 'tag' && node.name === 'svg') {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findSvgElement(child);
      if (found) return found;
    }
  }
  return null;
}

const files = getAllAstroFiles(distDir);
const total = files.length;

console.log(`Found ${total} .astro files\n`);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Extract the part after the frontmatter (---)
  const parts = content.split('---');
  if (parts.length >= 3) {
    const htmlPart = parts.slice(2).join('---').trim();
    const doc = parseDocument(htmlPart);
    const svg = findSvgElement(doc);
    
    if (svg) {
      const fillAttr = svg.attribs?.fill;
      
      // Skip if fill="none" (stroke-based icons)
      if (fillAttr === 'none') {
        skippedNone++;
        processed++;
        if (processed % 500 === 0 || processed === total) {
          process.stdout.write(`\rProgress: ${processed}/${total} | Modified: ${modified} | Skipped (none): ${skippedNone} | Skipped (exists): ${skippedExists}`);
        }
        continue;
      }
      
      // Skip if already has fill="currentColor"
      if (fillAttr === 'currentColor') {
        skippedExists++;
        processed++;
        if (processed % 500 === 0 || processed === total) {
          process.stdout.write(`\rProgress: ${processed}/${total} | Modified: ${modified} | Skipped (none): ${skippedNone} | Skipped (exists): ${skippedExists}`);
        }
        continue;
      }
      
      // Add fill="currentColor" before {...Astro.props}
      if (content.includes('{...Astro.props}')) {
        const newContent = content.replace(/{\.\.\.Astro\.props}/g, 'fill="currentColor" {...Astro.props}');
        fs.writeFileSync(file, newContent);
        modified++;
      }
    }
  }
  
  processed++;
  if (processed % 500 === 0 || processed === total) {
    process.stdout.write(`\rProgress: ${processed}/${total} | Modified: ${modified} | Skipped (none): ${skippedNone} | Skipped (exists): ${skippedExists}`);
  }
}

console.log('\n\n=== SUMMARY ===');
console.log(`Total files: ${total}`);
console.log(`Modified: ${modified}`);
console.log(`Skipped (fill="none"): ${skippedNone}`);
console.log(`Skipped (already has fill="currentColor"): ${skippedExists}`);
console.log('\nDone!');
