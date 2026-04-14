const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 8080;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing - return index.html for all routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  const shouldAutoOpen = process.env.NO_AUTO_OPEN !== '1';
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║         Genpact Pricing App - Server Running            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

✅ Server is running at: http://localhost:${PORT}

🌐 ${shouldAutoOpen ? 'Opening in your default browser...' : 'Auto-open disabled (NO_AUTO_OPEN=1)'}
📁 Serving files from: ${path.join(__dirname, 'dist')}

Press Ctrl+C to stop the server.
  `);

  if (!shouldAutoOpen) {
    return;
  }
  
  // Open browser automatically
  const url = `http://localhost:${PORT}`;
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
    console.error(`
❌ Error: Port ${PORT} is already in use.
   Please close the other application using this port or change the PORT in server.js
    `);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped successfully.');
    process.exit(0);
  });
});
