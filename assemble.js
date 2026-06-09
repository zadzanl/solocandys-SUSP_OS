/**
 * SUSP.OS — Zero-dependency build-time assembler
 * Compiles split sources under src/ into a single self-contained index.html
 */

const fs = require('fs');
const path = require('path');

/**
 * Assembles the index.html content in memory from the given source directory.
 * @param {string} [srcDir] Path to the source directory. Defaults to path.join(__dirname, 'src').
 * @returns {string} The fully assembled HTML content with normalized newlines.
 */
function assembleIndexHtml(srcDir = path.join(__dirname, 'src')) {
  // 1. Read the template
  const templatePath = path.join(srcDir, 'index.template.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at: ${templatePath}`);
  }
  let html = fs.readFileSync(templatePath, 'utf8');

  // 2. Read and inject CSS styles
  const stylesPath = path.join(srcDir, 'styles.css');
  let stylesContent = '';
  if (fs.existsSync(stylesPath)) {
    stylesContent = fs.readFileSync(stylesPath, 'utf8').trim();
  }
  const styleReplacement = stylesContent ? `<style>\n${stylesContent}\n</style>` : '';
  html = html.split('<!-- INJECT_STYLE -->').join(styleReplacement);

  // 3. Read and inject shared modules (physics.js, codec.js)
  let sharedModulesContent = '';
  const physicsPath = path.join(srcDir, 'physics.js');
  if (fs.existsSync(physicsPath)) {
    sharedModulesContent += `<script>\n${fs.readFileSync(physicsPath, 'utf8').trim()}\n</script>\n`;
  }
  const codecPath = path.join(srcDir, 'codec.js');
  if (fs.existsSync(codecPath)) {
    sharedModulesContent += `<script>\n${fs.readFileSync(codecPath, 'utf8').trim()}\n</script>\n`;
  }
  html = html.split('<!-- INJECT_SHARED_MODULES -->').join(sharedModulesContent.trim());

  // 4. Read and inject components and app source
  let appSourceContent = '';
  
  // Read components from src/components/ if directory exists
  const componentsDir = path.join(srcDir, 'components');
  if (fs.existsSync(componentsDir) && fs.statSync(componentsDir).isDirectory()) {
    const files = fs.readdirSync(componentsDir);
    // Stable sorting of components
    const jsxFiles = files
      .filter(f => f.endsWith('.js') || f.endsWith('.jsx'))
      .sort();
    
    for (const file of jsxFiles) {
      const filePath = path.join(componentsDir, file);
      appSourceContent += fs.readFileSync(filePath, 'utf8').trim() + '\n\n';
    }
  }

  // Read app.jsx if it exists in src/
  const appJsxPath = path.join(srcDir, 'app.jsx');
  if (fs.existsSync(appJsxPath)) {
    appSourceContent += fs.readFileSync(appJsxPath, 'utf8').trim();
  }

  html = html.split('<!-- INJECT_APP_SOURCE -->').join(appSourceContent.trim());

  // 5. Read and inject bootstrap code
  const bootstrapPath = path.join(srcDir, 'bootstrap.js');
  let bootstrapReplacement = '';
  if (fs.existsSync(bootstrapPath)) {
    bootstrapReplacement = `<script>\n${fs.readFileSync(bootstrapPath, 'utf8').trim()}\n</script>`;
  }
  html = html.split('<!-- INJECT_BOOTSTRAP -->').join(bootstrapReplacement);

  // Normalize all newlines to \n for cross-platform deterministic byte-for-byte output
  html = html.replace(/\r\n/g, '\n');

  // Ensure template comments that weren't replaced are cleaned up or handled gracefully.
  // We trim trailing whitespaces/newlines to match output.
  return html.trim() + '\n';
}

// If run directly from the command line, write to root index.html
if (require.main === module) {
  try {
    const distPath = path.join(__dirname, 'index.html');
    const assembledHtml = assembleIndexHtml();
    fs.writeFileSync(distPath, assembledHtml, 'utf8');
    console.log(`Successfully assembled index.html (${Buffer.byteLength(assembledHtml, 'utf8')} bytes)`);
  } catch (err) {
    console.error(`Assembly error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  assembleIndexHtml
};
