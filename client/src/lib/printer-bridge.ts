/**
 * PWA Thermal Printer Bridge - Multi-Protocol Support
 * Supports: Web Bluetooth, Web Serial, Network Printing, and Local Proxy
 */

export interface PrinterConnection {
  type: 'bluetooth' | 'serial' | 'network' | 'proxy';
  connected: boolean;
  device?: any;
  name?: string;
}

export interface PrintJob {
  type: 'kot' | 'bot' | 'receipt' | 'custom';
  content: string;
  copies?: number;
}

// ESC/POS Commands for thermal printers
export const ESC_POS = {
  INIT: [0x1B, 0x40],           // Initialize printer
  CUT: [0x1D, 0x56, 0x00],      // Cut paper
  NEWLINE: [0x0A],              // New line
  ALIGN_CENTER: [0x1B, 0x61, 0x01],
  ALIGN_LEFT: [0x1B, 0x61, 0x00],
  BOLD_ON: [0x1B, 0x45, 0x01],
  BOLD_OFF: [0x1B, 0x45, 0x00],
  DOUBLE_HEIGHT: [0x1B, 0x21, 0x10],
  NORMAL_SIZE: [0x1B, 0x21, 0x00],
};

export class ThermalPrinterBridge {
  private connections: Map<string, PrinterConnection> = new Map();
  
  constructor() {
    this.detectCapabilities();
  }

  private detectCapabilities() {
    console.log('🖨️ Detecting printer connection capabilities...');
    console.log({
      bluetooth: 'bluetooth' in navigator,
      serial: 'serial' in navigator,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    });
  }

  /**
   * 1. Web Bluetooth API - Mobile & Desktop Chrome/Edge
   */
  async connectBluetooth(): Promise<PrinterConnection | null> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth not supported in this browser');
    }

    try {
      console.log('🔵 Requesting Bluetooth device...');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common thermal printer
          { namePrefix: 'MTP-' },     // Many thermal printers
          { namePrefix: 'RDM-' },     // Rongta printers
          { namePrefix: 'Printer' },  // Generic printers
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      console.log('🔵 Connecting to GATT server...');
      const server = await device.gatt.connect();
      
      const connection: PrinterConnection = {
        type: 'bluetooth',
        connected: true,
        device: { device, server },
        name: device.name || 'Bluetooth Printer'
      };

      this.connections.set('bluetooth', connection);
      console.log('✅ Bluetooth printer connected:', device.name);
      return connection;

    } catch (error) {
      console.error('❌ Bluetooth connection failed:', error);
      throw error;
    }
  }

  /**
   * 2. Web Serial API - Desktop Chrome/Edge (USB)
   */
  async connectSerial(): Promise<PrinterConnection | null> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial not supported in this browser');
    }

    try {
      console.log('🔌 Requesting serial port...');
      
      const port = await (navigator as any).serial.requestPort({
        filters: [
          { usbVendorId: 0x0DD4 }, // ATEN International
          { usbVendorId: 0x04B8 }, // Seiko Epson
          { usbVendorId: 0x04E8 }, // Samsung
        ]
      });

      await port.open({ baudRate: 9600 });

      const connection: PrinterConnection = {
        type: 'serial',
        connected: true,
        device: port,
        name: 'USB Thermal Printer'
      };

      this.connections.set('serial', connection);
      console.log('✅ Serial printer connected');
      return connection;

    } catch (error) {
      console.error('❌ Serial connection failed:', error);
      throw error;
    }
  }

  /**
   * 3. Network Printing - Direct TCP/IP to printer IP
   */
  async connectNetwork(ipAddress: string, port: number = 9100): Promise<PrinterConnection | null> {
    try {
      console.log(`🌐 Testing network printer at ${ipAddress}:${port}...`);
      
      // Test connectivity through our backend API
      const response = await fetch('/api/printer-configurations/test-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, port })
      });

      const result = await response.json();
      
      if (result.success) {
        const connection: PrinterConnection = {
          type: 'network',
          connected: true,
          device: { ipAddress, port },
          name: `Network Printer (${ipAddress})`
        };

        this.connections.set('network', connection);
        console.log('✅ Network printer connected');
        return connection;
      } else {
        throw new Error(result.error || 'Network connection failed');
      }

    } catch (error) {
      console.error('❌ Network connection failed:', error);
      throw error;
    }
  }

  /**
   * 4. Local Proxy - Browser-based proxy service
   */
  async connectProxy(): Promise<PrinterConnection | null> {
    try {
      console.log('🔄 Connecting through local proxy...');
      
      // Check if local proxy service is running
      const response = await fetch('http://localhost:8899/api/status', {
        method: 'GET',
        mode: 'cors'
      });

      if (response.ok) {
        const connection: PrinterConnection = {
          type: 'proxy',
          connected: true,
          device: { proxyUrl: 'http://localhost:8899' },
          name: 'Local Proxy Service'
        };

        this.connections.set('proxy', connection);
        console.log('✅ Proxy connection established');
        return connection;
      } else {
        throw new Error('Proxy service not available');
      }

    } catch (error) {
      console.error('❌ Proxy connection failed:', error);
      throw error;
    }
  }

  /**
   * Auto-detect and connect to best available printer
   */
  async autoConnect(printerConfig?: any): Promise<PrinterConnection | null> {
    console.log('🔍 Auto-detecting printer connection method...');

    // Priority order based on reliability and device type
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const methods = isMobile 
      ? ['bluetooth', 'network', 'proxy']  // Mobile: prefer Bluetooth
      : ['network', 'serial', 'bluetooth', 'proxy']; // Desktop: prefer network/USB

    for (const method of methods) {
      try {
        let connection: PrinterConnection | null = null;

        switch (method) {
          case 'bluetooth':
            connection = await this.connectBluetooth();
            break;
          case 'serial':
            connection = await this.connectSerial();
            break;
          case 'network':
            if (printerConfig?.ipAddress) {
              connection = await this.connectNetwork(printerConfig.ipAddress, printerConfig.port);
            }
            break;
          case 'proxy':
            connection = await this.connectProxy();
            break;
        }

        if (connection) {
          console.log(`✅ Auto-connected via ${method}:`, connection.name);
          return connection;
        }

      } catch (error) {
        console.log(`⚠️ ${method} connection failed, trying next method...`);
      }
    }

    throw new Error('No printer connection method available');
  }

  /**
   * Print to connected printer
   */
  async print(job: PrintJob): Promise<boolean> {
    console.log('🖨️ Printing job:', job);

    // Get active connection
    const connection = Array.from(this.connections.values()).find(c => c.connected);
    if (!connection) {
      throw new Error('No printer connected');
    }

    const printData = this.formatPrintData(job);

    try {
      switch (connection.type) {
        case 'bluetooth':
          return await this.printBluetooth(connection, printData);
        case 'serial':
          return await this.printSerial(connection, printData);
        case 'network':
          return await this.printNetwork(connection, printData);
        case 'proxy':
          return await this.printProxy(connection, printData);
        default:
          throw new Error(`Unsupported connection type: ${connection.type}`);
      }
    } catch (error) {
      console.error('❌ Print failed:', error);
      throw error;
    }
  }

  /**
   * Format print data with ESC/POS commands
   */
  private formatPrintData(job: PrintJob): Uint8Array {
    const commands: number[] = [];
    
    // Initialize printer
    commands.push(...ESC_POS.INIT);
    
    // Header
    commands.push(...ESC_POS.ALIGN_CENTER);
    commands.push(...ESC_POS.DOUBLE_HEIGHT);
    commands.push(...ESC_POS.BOLD_ON);
    
    const header = job.type === 'kot' ? 'KITCHEN ORDER' : 
                   job.type === 'bot' ? 'BEVERAGE ORDER' : 'RECEIPT';
    
    commands.push(...this.stringToBytes(header));
    commands.push(...ESC_POS.NEWLINE);
    commands.push(...ESC_POS.NORMAL_SIZE);
    commands.push(...ESC_POS.BOLD_OFF);
    commands.push(...ESC_POS.NEWLINE);
    
    // Content
    commands.push(...ESC_POS.ALIGN_LEFT);
    commands.push(...this.stringToBytes(job.content));
    commands.push(...ESC_POS.NEWLINE);
    commands.push(...ESC_POS.NEWLINE);
    
    // Footer
    commands.push(...ESC_POS.ALIGN_CENTER);
    commands.push(...this.stringToBytes(`--- ${new Date().toLocaleString()} ---`));
    commands.push(...ESC_POS.NEWLINE);
    commands.push(...ESC_POS.NEWLINE);
    commands.push(...ESC_POS.NEWLINE);
    
    // Cut paper
    commands.push(...ESC_POS.CUT);
    
    return new Uint8Array(commands);
  }

  private stringToBytes(str: string): number[] {
    return Array.from(new TextEncoder().encode(str));
  }

  // Print method implementations
  private async printBluetooth(connection: PrinterConnection, data: Uint8Array): Promise<boolean> {
    const { device, server } = connection.device;
    
    try {
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      
      // Send data in chunks (Bluetooth has limited packet size)
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await characteristic.writeValue(chunk);
      }
      
      console.log('✅ Bluetooth print successful');
      return true;
      
    } catch (error) {
      console.error('❌ Bluetooth print failed:', error);
      return false;
    }
  }

  private async printSerial(connection: PrinterConnection, data: Uint8Array): Promise<boolean> {
    const port = connection.device;
    
    try {
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      
      console.log('✅ Serial print successful');
      return true;
      
    } catch (error) {
      console.error('❌ Serial print failed:', error);
      return false;
    }
  }

  private async printNetwork(connection: PrinterConnection, data: Uint8Array): Promise<boolean> {
    const { ipAddress, port } = connection.device;
    
    try {
      const response = await fetch('/api/printer-configurations/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress,
          port,
          data: Array.from(data)
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Network print successful');
        return true;
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('❌ Network print failed:', error);
      return false;
    }
  }

  private async printProxy(connection: PrinterConnection, data: Uint8Array): Promise<boolean> {
    const { proxyUrl } = connection.device;
    
    try {
      const response = await fetch(`${proxyUrl}/api/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: Array.from(data)
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Proxy print successful');
        return true;
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('❌ Proxy print failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect(type?: string): Promise<void> {
    if (type) {
      const connection = this.connections.get(type);
      if (connection) {
        if (connection.type === 'bluetooth' && connection.device?.server) {
          await connection.device.server.disconnect();
        } else if (connection.type === 'serial' && connection.device?.close) {
          await connection.device.close();
        }
        this.connections.delete(type);
        console.log(`🔌 Disconnected from ${type} printer`);
      }
    } else {
      // Disconnect all
      for (const [key, connection] of Array.from(this.connections.entries())) {
        await this.disconnect(key);
      }
    }
  }

  /**
   * Get connection status
   */
  getConnections(): PrinterConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if any printer is connected
   */
  isConnected(): boolean {
    return Array.from(this.connections.values()).some(c => c.connected);
  }
}

// Singleton instance
export const printerBridge = new ThermalPrinterBridge();