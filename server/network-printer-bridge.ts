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

    // Test common printer IPs in the range
    for (let i = 100; i <= 200; i++) {
      const ip = `${ipRange}.${i}`;
      promises.push(
        this.testPrinterConnection(ip, 9100, 3000).then((isOnline) => {
          if (isOnline) {
            discoveredPrinters.push(ip);
            console.log(`🖨️  Discovered printer at ${ip}:9100`);
          }
        }).catch(() => {
          // Ignore errors during discovery
        })
      );
    }

    await Promise.all(promises);
    return discoveredPrinters;
  }

  /**
   * Enhanced printer connectivity test with better error handling
   */
  async testPrinterConnection(
    ipAddress: string, 
    port: number = 9100, 
    timeout: number = 10000
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
      } else if (line.includes('Table:') || line.includes('Room:') || line.includes('Customer:') || line.includes('Order #')) {
        // Important info
        thermalContent += commands.ALIGN_LEFT + commands.BOLD_ON + line + commands.BOLD_OFF + commands.FEED;
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