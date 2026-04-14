const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 8080;

// Determine the correct dist path
// When running as .exe (pkg), use path relative to executable
// When running normally, use path relative to this file
const distPath = process.pkg
  ? path.join(path.dirname(process.execPath), 'dist')
  : (process.nexe
      ? path.join(__dirname, 'dist')
      : path.join(__dirname, 'dist'));

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                                                          ║');
console.log('║         Genpact Pricing App - Server Running            ║');
console.log('║                                                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('📁 Serving files from:', distPath);
console.log('');

// Serve static files from the dist directory
app.use(express.static(distPath));

// Handle all routes - return index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('✅ Server is running at:', url);
  console.log('');
  const shouldAutoOpen = process.env.NO_AUTO_OPEN !== '1';
  console.log(shouldAutoOpen ? '🌐 Opening in your default browser...' : '🌐 Auto-open disabled (NO_AUTO_OPEN=1)');
  console.log('');
  console.log('Press Ctrl+C to stop the server.');
  console.log('');
  
  if (!shouldAutoOpen) {
    return;
  }

  // Open browser automatically
  const openCommand =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(openCommand, (error) => {
    if (error) {
      console.warn('⚠️ Could not auto-open browser. Open manually:', url);
    }
  });
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('❌ Error: Port', PORT, 'is already in use.');
    console.error('   Please close the other application using this port.');
    console.error('');
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped successfully.');
    process.exit(0);
  });
});
