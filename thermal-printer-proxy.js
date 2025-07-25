#!/usr/bin/env node
/**
 * Local Thermal Printer Proxy Service
 * Enables PWA to print directly to local network thermal printers
 * 
 * Installation:
 * 1. Save this file as thermal-printer-proxy.js
 * 2. Run: node thermal-printer-proxy.js
 * 3. The proxy will run on http://localhost:8899
 * 4. Configure your PWA to use this proxy for printing
 */

const http = require('http');
const net = require('net');
const url = require('url');

const PORT = 8899;

// CORS headers for PWA access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Default thermal printer settings
const DEFAULT_PRINTER_CONFIGS = [
  { name: 'Kitchen Printer', ip: '192.168.1.100', port: 9100, type: 'kot' },
  { name: 'Bar Printer', ip: '192.168.1.101', port: 9100, type: 'bot' },
  { name: 'Receipt Printer', ip: '192.168.1.102', port: 9100, type: 'receipt' }
];

let printerConfigs = [...DEFAULT_PRINTER_CONFIGS];

function sendResponse(res, statusCode, data, contentType = 'application/json') {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  res.setHeader('Content-Type', contentType);
  res.statusCode = statusCode;
  
  if (contentType === 'application/json') {
    res.end(JSON.stringify(data));
  } else {
    res.end(data);
  }
}

function testPrinterConnection(ip, port, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    }, timeout);

    socket.connect(port, ip, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ success: true, message: 'Printer accessible' });
    });

    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message });
    });
  });
}

function sendToPrinter(ip, port, data, timeout = 10000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'Print timeout' });
    }, timeout);

    socket.connect(port, ip, () => {
      // Send print data
      const buffer = Buffer.from(data);
      socket.write(buffer);
      
      // Wait a moment for data to be sent, then close
      setTimeout(() => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ success: true, message: 'Print job sent successfully' });
      }, 1000);
    });

    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, error: error.message });
    });
  });
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;
  const method = req.method;

  console.log(`${new Date().toISOString()} ${method} ${pathname}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    sendResponse(res, 200, {});
    return;
  }

  try {
    // Health check endpoint
    if (pathname === '/api/status' && method === 'GET') {
      sendResponse(res, 200, {
        status: 'running',
        service: 'Thermal Printer Proxy',
        version: '1.0.0',
        port: PORT,
        printers: printerConfigs.length
      });
      return;
    }

    // Get printer configurations
    if (pathname === '/api/printers' && method === 'GET') {
      sendResponse(res, 200, { printers: printerConfigs });
      return;
    }

    // Test printer connection
    if (pathname === '/api/test' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { ip, port = 9100 } = body;
      
      if (!ip) {
        sendResponse(res, 400, { success: false, error: 'IP address required' });
        return;
      }

      const result = await testPrinterConnection(ip, port);
      sendResponse(res, 200, result);
      return;
    }

    // Print to thermal printer
    if (pathname === '/api/print' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { ip, port = 9100, data, printerType } = body;
      
      if (!data) {
        sendResponse(res, 400, { success: false, error: 'Print data required' });
        return;
      }

      let targetIp = ip;
      let targetPort = port;

      // If printer type is specified, use configured printer
      if (printerType && !ip) {
        const configuredPrinter = printerConfigs.find(p => p.type === printerType);
        if (configuredPrinter) {
          targetIp = configuredPrinter.ip;
          targetPort = configuredPrinter.port;
        }
      }

      if (!targetIp) {
        sendResponse(res, 400, { success: false, error: 'Printer IP address required' });
        return;
      }

      const result = await sendToPrinter(targetIp, targetPort, data);
      sendResponse(res, 200, result);
      return;
    }

    // Configure printers
    if (pathname === '/api/configure' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { printers } = body;
      
      if (Array.isArray(printers)) {
        printerConfigs = printers;
        sendResponse(res, 200, { 
          success: true, 
          message: 'Printer configurations updated',
          printers: printerConfigs.length
        });
      } else {
        sendResponse(res, 400, { success: false, error: 'Invalid printer configuration' });
      }
      return;
    }

    // Serve simple web interface
    if (pathname === '/' && method === 'GET') {
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Thermal Printer Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .printer { border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px; }
        button { padding: 8px 16px; margin: 5px; cursor: pointer; }
        input, textarea { padding: 5px; margin: 5px; }
    </style>
</head>
<body>
    <h1>🖨️ Thermal Printer Proxy Service</h1>
    <div class="status success">
        ✅ Service Running on Port ${PORT}
    </div>
    
    <h2>Configured Printers</h2>
    <div id="printers">
        ${printerConfigs.map(p => `
            <div class="printer">
                <strong>${p.name}</strong> (${p.type})<br>
                IP: ${p.ip}:${p.port}
                <button onclick="testPrinter('${p.ip}', ${p.port})">Test Connection</button>
            </div>
        `).join('')}
    </div>
    
    <h2>Test Print</h2>
    <div>
        <input type="text" id="testIp" placeholder="Printer IP (e.g., 192.168.1.100)" value="192.168.1.100">
        <input type="number" id="testPort" placeholder="Port" value="9100">
        <br>
        <textarea id="testContent" rows="5" cols="50" placeholder="Test content to print">
Test Print from Proxy Service
Direct Thermal Printing
Working Successfully!

Thank you for testing.
        </textarea>
        <br>
        <button onclick="testPrint()">Send Test Print</button>
    </div>
    
    <div id="result"></div>
    
    <h2>PWA Integration</h2>
    <p>To use this proxy service from your PWA:</p>
    <pre>
// JavaScript code for your PWA
const proxyUrl = 'http://localhost:${PORT}';

// Test connection
const testResult = await fetch(proxyUrl + '/api/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ip: '192.168.1.100', port: 9100 })
});

// Print content
const printResult = await fetch(proxyUrl + '/api/print', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    ip: '192.168.1.100', 
    port: 9100,
    data: [27, 64, 72, 101, 108, 108, 111, 10] // ESC/POS commands
  })
});
    </pre>
    
    <script>
        async function testPrinter(ip, port) {
            const result = document.getElementById('result');
            result.innerHTML = 'Testing connection...';
            
            try {
                const response = await fetch('/api/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, port })
                });
                
                const data = await response.json();
                result.innerHTML = data.success ? 
                    '<div class="status success">✅ ' + data.message + '</div>' :
                    '<div class="status error">❌ ' + data.error + '</div>';
                    
            } catch (error) {
                result.innerHTML = '<div class="status error">❌ ' + error.message + '</div>';
            }
        }
        
        async function testPrint() {
            const ip = document.getElementById('testIp').value;
            const port = parseInt(document.getElementById('testPort').value);
            const content = document.getElementById('testContent').value;
            const result = document.getElementById('result');
            
            if (!ip || !content) {
                result.innerHTML = '<div class="status error">❌ Please enter IP and content</div>';
                return;
            }
            
            result.innerHTML = 'Sending print job...';
            
            try {
                // Convert text to byte array (simple ASCII)
                const data = Array.from(content, c => c.charCodeAt(0));
                
                const response = await fetch('/api/print', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, port, data })
                });
                
                const responseData = await response.json();
                result.innerHTML = responseData.success ? 
                    '<div class="status success">✅ ' + responseData.message + '</div>' :
                    '<div class="status error">❌ ' + responseData.error + '</div>';
                    
            } catch (error) {
                result.innerHTML = '<div class="status error">❌ ' + error.message + '</div>';
            }
        }
    </script>
</body>
</html>`;
      sendResponse(res, 200, html, 'text/html');
      return;
    }

    // 404 for other endpoints
    sendResponse(res, 404, { error: 'Endpoint not found' });

  } catch (error) {
    console.error('Server error:', error);
    sendResponse(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🖨️ Thermal Printer Proxy Service');
  console.log('================================');
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 Accessible from PWA at http://localhost:${PORT}`);
  console.log(`🔧 Web interface: http://localhost:${PORT}`);
  console.log(`📄 API endpoints:`);
  console.log(`   GET  /api/status    - Service health check`);
  console.log(`   GET  /api/printers  - List configured printers`);
  console.log(`   POST /api/test      - Test printer connection`);
  console.log(`   POST /api/print     - Send print job`);
  console.log(`   POST /api/configure - Update printer configs`);
  console.log('');
  console.log('📋 Configured Printers:');
  printerConfigs.forEach(p => {
    console.log(`   ${p.name} (${p.type}) - ${p.ip}:${p.port}`);
  });
  console.log('');
  console.log('💡 To stop the service, press Ctrl+C');
  console.log('================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Thermal Printer Proxy Service...');
  server.close(() => {
    console.log('✅ Service stopped gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Service stopped gracefully');
    process.exit(0);
  });
});