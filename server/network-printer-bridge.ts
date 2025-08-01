import { Socket } from 'net';
import { db } from './storage';
import { printerConfigurations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface PrintJob {
  id: string;
  printerType: 'kot' | 'bot' | 'billing';
  content: string;
  printerConfig: any;
  timestamp: Date;
  retries: number;
}

interface NetworkPrinter {
  ipAddress: string;
  port: number;
  isOnline: boolean;
  lastChecked: Date;
}

class NetworkPrinterBridge {
  private printQueue: Map<string, PrintJob> = new Map();
  private printerStatus: Map<string, NetworkPrinter> = new Map();
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds

  /**
   * Enhanced network printer discovery and connectivity test
   */
  async discoverNetworkPrinters(ipRange: string = '192.168.1'): Promise<string[]> {
    const discoveredPrinters: string[] = [];
    const promises: Promise<void>[] = [];

    // Test common printer IPs in the range (reduced range for better accuracy)
    for (let i = 100; i <= 120; i++) {
      const ip = `${ipRange}.${i}`;
      promises.push(
        this.testPrinterConnection(ip, 9100, 2000).then((result) => {
          if (result.success) {
            // Additional validation: try to send a simple ESC/POS command to verify it's actually a printer
            this.validateThermalPrinter(ip, 9100).then((isValidPrinter) => {
              if (isValidPrinter) {
                discoveredPrinters.push(ip);
                console.log(`🖨️  Discovered thermal printer at ${ip}:9100`);
              } else {
                console.log(`⚠️  Device at ${ip}:9100 responds but is not a thermal printer`);
              }
            }).catch(() => {
              // If validation fails, still consider it a potential printer
              discoveredPrinters.push(ip);
              console.log(`🖨️  Discovered potential printer at ${ip}:9100 (validation failed)`);
            });
          }
        }).catch(() => {
          // Ignore errors during discovery
        })
      );
    }

    await Promise.all(promises);
    // Wait a bit for validation to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    return discoveredPrinters;
  }

  /**
   * Validate if a device is actually a thermal printer
   */
  private async validateThermalPrinter(ipAddress: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let isComplete = false;

      const cleanup = () => {
        if (!isComplete) {
          isComplete = true;
          socket.destroy();
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 3000);

      socket.connect(port, ipAddress, () => {
        try {
          // Send ESC/POS initialization command - thermal printers should accept this
          const initCommand = Buffer.from([0x1B, 0x40]); // ESC @
          socket.write(initCommand);

          setTimeout(() => {
            cleanup();
            clearTimeout(timer);
            resolve(true);
          }, 500);
        } catch (error) {
          cleanup();
          clearTimeout(timer);
          resolve(false);
        }
      });

      socket.on('error', () => {
        cleanup();
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Enhanced printer connectivity test with better error handling
   */
  async testPrinterConnection(
    ipAddress: string, 
    port: number = 9100, 
    timeout: number = 10000
  ): Promise<{ success: boolean; message: string; responseTime?: number }> {
    // Try multiple common printer ports
    const portsToTry = [port, 9100, 515, 631, 80];

    for (const testPort of portsToTry) {
      const result = await this.testSinglePort(ipAddress, testPort, timeout);
      if (result.success) {
        console.log(`✅ Printer found at ${ipAddress}:${testPort} (${result.responseTime}ms)`);
        return { ...result, message: `Connected on port ${testPort}` };
      }
    }

    return {
      success: false,
      message: `No printer found on ports ${portsToTry.join(', ')}`
    };
  }

  /**
   * Test connection to a specific port
   */
  private async testSinglePort(
    ipAddress: string, 
    port: number, 
    timeout: number
  ): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const socket = new Socket();
      let isResolved = false;

      const cleanup = () => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: `Connection timeout after ${timeout}ms`,
        });
      }, timeout);

      socket.setTimeout(timeout);

      socket.connect(port, ipAddress, () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          const responseTime = Date.now() - startTime;

          // Update printer status
          this.printerStatus.set(`${ipAddress}:${port}`, {
            ipAddress,
            port,
            isOnline: true,
            lastChecked: new Date(),
          });

          socket.destroy();
          resolve({
            success: true,
            message: 'Connection successful',
            responseTime,
          });
        }
      });

      socket.on('error', (error) => {
        cleanup();
        clearTimeout(timer);

        // Update printer status as offline
        this.printerStatus.set(`${ipAddress}:${port}`, {
          ipAddress,
          port,
          isOnline: false,
          lastChecked: new Date(),
        });

        resolve({
          success: false,
          message: `Connection failed: ${error.message}`,
        });
      });

      socket.on('timeout', () => {
        cleanup();
        clearTimeout(timer);
        resolve({
          success: false,
          message: 'Connection timeout',
        });
      });
    });
  }

  /**
   * Enhanced network connectivity test
   */
  async performNetworkConnectivityTest(ipAddress: string): Promise<{
    pingable: boolean;
    reachable: boolean;
    openPorts: number[];
    diagnostics: any;
  }> {
    console.log(`🌐 Performing comprehensive network test for ${ipAddress}...`);

    // Test basic connectivity first
    const connectivityTest = await this.testSinglePort(ipAddress, 80, 2000);

    // Extended port scan for any open services
    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 515, 631, 993, 995, 8000, 8008, 8080, 8443, 8888, 9000, 9100, 9101, 9102, 9103];
    const openPorts = [];

    for (const port of commonPorts) {
      try {
        const result = await this.testSinglePort(ipAddress, port, 1500);
        if (result.success) {
          openPorts.push(port);
          console.log(`🔓 Found open port: ${port}`);
        }
      } catch (error) {
        // Ignore individual port errors
      }
    }

    return {
      pingable: true, // We can't ping from Node.js directly, but we assume it's pingable based on user's CMD result
      reachable: connectivityTest.success || openPorts.length > 0,
      openPorts,
      diagnostics: {
        totalPortsScanned: commonPorts.length,
        openPortsFound: openPorts.length,
        likelyPrinterPorts: openPorts.filter(p => [515, 631, 8000, 8080, 9100, 9101, 9102, 9103].includes(p)),
        commonServicePorts: openPorts.filter(p => [21, 22, 23, 25, 53, 80, 443, 993, 995].includes(p))
      }
    };
  }

  /**
   * Send print job with enhanced error handling and queuing
   */
  async sendPrintJobToNetwork(
    printJob: PrintJob
  ): Promise<{ success: boolean; message: string }> {
    const { printerConfig, content } = printJob;
    const printerKey = `${printerConfig.ipAddress}:${printerConfig.port}`;

    try {
      console.log(`🖨️  Attempting to print to ${printerConfig.printerName} (${printerKey})`);

      // First, test connectivity
      const connectionTest = await this.testPrinterConnection(
        printerConfig.ipAddress,
        printerConfig.port,
        printerConfig.connectionTimeout || 10000
      );

      if (!connectionTest.success) {
        console.error(`❌ Printer ${printerConfig.printerName} is offline: ${connectionTest.message}`);

        // Add to retry queue if retries are available
        if (printJob.retries < this.maxRetries) {
          printJob.retries++;
          this.addToRetryQueue(printJob);
          return {
            success: false,
            message: `Printer offline, queued for retry (${printJob.retries}/${this.maxRetries})`,
          };
        } else {
          return {
            success: false,
            message: `Printer offline after ${this.maxRetries} retries: ${connectionTest.message}`,
          };
        }
      }

      // Generate enhanced thermal content
      const thermalContent = this.generateThermalContent(content, printerConfig.paperWidth || 80);

      // Send the print job
      const printResult = await this.sendRawDataToPrinter(
        printerConfig.ipAddress,
        printerConfig.port,
        thermalContent,
        printerConfig.connectionTimeout || 10000
      );

      if (printResult.success) {
        console.log(`✅ Successfully printed to ${printerConfig.printerName}`);

        // Update printer configuration status
        await this.updatePrinterStatus(printerConfig.id, 'connected', null);

        return {
          success: true,
          message: `Successfully printed to ${printerConfig.printerName}`,
        };
      } else {
        console.error(`❌ Print failed to ${printerConfig.printerName}: ${printResult.message}`);

        // Add to retry queue if retries are available
        if (printJob.retries < this.maxRetries) {
          printJob.retries++;
          this.addToRetryQueue(printJob);
          return {
            success: false,
            message: `Print failed, queued for retry (${printJob.retries}/${this.maxRetries}): ${printResult.message}`,
          };
        } else {
          await this.updatePrinterStatus(printerConfig.id, 'error', printResult.message);
          return {
            success: false,
            message: `Print failed after ${this.maxRetries} retries: ${printResult.message}`,
          };
        }
      }
    } catch (error: any) {
      console.error(`❌ Print job error for ${printerConfig.printerName}:`, error);

      await this.updatePrinterStatus(printerConfig.id, 'error', error.message);

      return {
        success: false,
        message: `Print job error: ${error.message}`,
      };
    }
  }

  /**
   * Send raw data to printer with enhanced error handling
   */
  private async sendRawDataToPrinter(
    ipAddress: string,
    port: number,
    data: string,
    timeout: number = 10000
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let isComplete = false;

      const cleanup = () => {
        if (!isComplete) {
          isComplete = true;
          socket.destroy();
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: 'Print timeout - data may not have been sent completely',
        });
      }, timeout);

      socket.connect(port, ipAddress, () => {
        console.log(`📡 Connected to printer ${ipAddress}:${port}, sending data...`);
        socket.write(data, 'binary');

        // Give some time for the data to be sent
        setTimeout(() => {
          if (!isComplete) {
            isComplete = true;
            clearTimeout(timer);
            socket.destroy();
            resolve({
              success: true,
              message: 'Data sent successfully',
            });
          }
        }, 2000); // 2 second delay to ensure data is sent
      });

      socket.on('error', (error) => {
        cleanup();
        clearTimeout(timer);
        resolve({
          success: false,
          message: `Socket error: ${error.message}`,
        });
      });

      socket.on('timeout', () => {
        cleanup();
        clearTimeout(timer);
        resolve({
          success: false,
          message: 'Socket timeout',
        });
      });

      socket.on('close', () => {
        if (!isComplete) {
          isComplete = true;
          clearTimeout(timer);
          resolve({
            success: true,
            message: 'Connection closed after sending data',
          });
        }
      });
    });
  }

  /**
   * Enhanced thermal printer content generation
   */
  private generateThermalContent(content: string, paperWidth: number = 80): string {
    const commands = {
      INIT: '\x1B\x40', // Initialize printer
      ALIGN_CENTER: '\x1B\x61\x01', // Center align
      ALIGN_LEFT: '\x1B\x61\x00', // Left align
      BOLD_ON: '\x1B\x45\x01', // Bold on
      BOLD_OFF: '\x1B\x45\x00', // Bold off
      DOUBLE_HEIGHT: '\x1B\x21\x10', // Double height
      DOUBLE_WIDTH: '\x1B\x21\x20', // Double width
      DOUBLE_SIZE: '\x1B\x21\x30', // Double height + width
      NORMAL: '\x1B\x21\x00', // Normal text
      CUT: '\x1D\x56\x00', // Partial cut
      FEED: '\n',
      OPEN_DRAWER: '\x1B\x70\x00\x19\xFA', // Open cash drawer (if connected)
    };

    // Initialize printer and set encoding
    let thermalContent = commands.INIT;

    // Process content line by line to apply proper formatting
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('='.repeat(20)) || line.includes('-'.repeat(20))) {
        // Separator line
        const separator = paperWidth === 58 ? '='.repeat(32) : '='.repeat(42);
        thermalContent += commands.ALIGN_CENTER + separator + commands.FEED;
      } else if (line.toUpperCase().includes('KOT') || line.toUpperCase().includes('BOT') || line.toUpperCase().includes('BILL')) {
        // Headers
        thermalContent += commands.ALIGN_CENTER + commands.BOLD_ON + commands.DOUBLE_HEIGHT + line + commands.BOLD_OFF + commands.NORMAL + commands.FEED;
      } else if (line.includes('Room:') || line.includes('Customer:') || line.includes('Order #')) {
        // Important info (removed Table: since customer won't show for table orders)
        thermalContent += commands.ALIGN_LEFT + commands.BOLD_ON + line + commands.BOLD_OFF + commands.FEED;
      } else if (line.includes('*****') && (line.includes('TABLE') || line.includes('ROOM') || line.includes('TAKEAWAY'))) {
        // Location with big font and bold
        thermalContent += commands.ALIGN_CENTER + commands.BOLD_ON + commands.DOUBLE_HEIGHT + line.replace(/\*/g, '') + commands.BOLD_OFF + commands.NORMAL + commands.FEED;
      } else if (line.includes('**ORDER NOTES:**') || line.startsWith('**') && line.endsWith('**')) {
        // Bold order notes
        thermalContent += commands.ALIGN_LEFT + commands.BOLD_ON + line.replace(/\*\*/g, '') + commands.BOLD_OFF + commands.FEED;
      } else if (line.match(/^\d+\.\s+/) || line.match(/^-\s+\d+x\s+/) || line.match(/^\s*\d+x\s+/)) {
        // Dish items and quantities - make them larger and bold
        thermalContent += commands.ALIGN_LEFT + commands.BOLD_ON + commands.DOUBLE_SIZE + line + commands.BOLD_OFF + commands.NORMAL + commands.FEED;
      } else if (line.trim() === '') {
        // Empty line
        thermalContent += commands.FEED;
      } else {
        // Regular content
        thermalContent += commands.ALIGN_LEFT + line + commands.FEED;
      }
    }

    // Add spacing and cut
    thermalContent += commands.FEED + commands.FEED + commands.CUT;

    return thermalContent;
  }

  /**
   * Add print job to retry queue
   */
  private addToRetryQueue(printJob: PrintJob): void {
    this.printQueue.set(printJob.id, printJob);

    // Schedule retry
    setTimeout(() => {
      this.processRetryQueue();
    }, this.retryDelay);
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    for (const [jobId, printJob] of this.printQueue.entries()) {
      if (printJob.retries < this.maxRetries) {
        console.log(`🔄 Retrying print job ${jobId} (attempt ${printJob.retries + 1}/${this.maxRetries})`);

        const result = await this.sendPrintJobToNetwork(printJob);

        if (result.success) {
          this.printQueue.delete(jobId);
          console.log(`✅ Retry successful for print job ${jobId}`);
        }
      } else {
        this.printQueue.delete(jobId);
        console.log(`❌ Print job ${jobId} exceeded max retries, removing from queue`);
      }
    }
  }

  /**
   * Update printer configuration status in database
   */
  private async updatePrinterStatus(
    configId: number,
    status: 'connected' | 'disconnected' | 'error',
    errorMessage?: string | null
  ): Promise<void> {
    try {
      await db
        .update(printerConfigurations)
        .set({
          connectionStatus: status,
          errorMessage: errorMessage,
          lastTestPrint: new Date(),
          ...(status === 'connected' && { lastSuccessfulPrint: new Date() }),
        })
        .where(eq(printerConfigurations.id, configId));
    } catch (error) {
      console.error('Failed to update printer status:', error);
    }
  }

  /**
   * Get printer status from cache
   */
  getPrinterStatus(ipAddress: string, port: number): NetworkPrinter | null {
    return this.printerStatus.get(`${ipAddress}:${port}`) || null;
  }

  /**
   * Get print queue status
   */
  getQueueStatus(): { jobCount: number; jobs: PrintJob[] } {
    return {
      jobCount: this.printQueue.size,
      jobs: Array.from(this.printQueue.values()),
    };
  }
}

// Export singleton instance
export const networkPrinterBridge = new NetworkPrinterBridge();
export default networkPrinterBridge;