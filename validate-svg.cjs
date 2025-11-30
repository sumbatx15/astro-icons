const fs = require('fs');
const path = require('path');
const { parseDocument } = require('htmlparser2');

const distDir = './dist';
let processed = 0;
let valid = 0;
let errors = [];
let missingFill = [];

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
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Extract the part after the frontmatter (---)
    const parts = content.split('---');
    if (parts.length < 3) {
      errors.push({ file, error: 'Invalid astro format (missing frontmatter)' });
      processed++;
      continue;
    }
    
    const htmlPart = parts.slice(2).join('---').trim();
    
    // Parse the SVG
    const doc = parseDocument(htmlPart);
    const svg = findSvgElement(doc);
    
    if (!svg) {
      errors.push({ file, error: 'No SVG element found' });
      processed++;
      continue;
    }
    
    // Check for fill="currentColor"
    const fillAttr = svg.attribs?.fill;
    if (fillAttr !== 'currentColor') {
      missingFill.push({ file, currentFill: fillAttr || '(none)' });
    }
    
    valid++;
  } catch (err) {
    errors.push({ file, error: err.message });
  }
  
  processed++;
  if (processed % 500 === 0 || processed === total) {
    process.stdout.write(`\rProgress: ${processed}/${total} | Valid: ${valid} | Errors: ${errors.length} | Missing fill: ${missingFill.length}`);
  }
}

console.log('\n\n=== SUMMARY ===');
console.log(`Total files: ${total}`);
console.log(`Valid SVGs: ${valid}`);
console.log(`Parse errors: ${errors.length}`);
console.log(`Missing fill="currentColor": ${missingFill.length}`);

if (errors.length > 0) {
  console.log('\n=== ERRORS (first 10) ===');
  errors.slice(0, 10).forEach(e => {
    console.log(`  ${e.file}: ${e.error}`);
  });
  if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
}

if (missingFill.length > 0) {
  console.log('\n=== MISSING FILL (first 10) ===');
  missingFill.slice(0, 10).forEach(e => {
    console.log(`  ${e.file}: fill=${e.currentFill}`);
  });
  if (missingFill.length > 10) console.log(`  ... and ${missingFill.length - 10} more`);
}

// Exit with error code if issues found
if (errors.length > 0 || missingFill.length > 0) {
  process.exit(1);
}

console.log('\n✓ All files valid!');

