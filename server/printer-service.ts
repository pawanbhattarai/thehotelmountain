import { Socket } from 'net';
import { db } from './storage';
import { printerConfigurations, hotelSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { networkPrinterBridge } from './network-printer-bridge';

interface PrinterCommand {
  command: string;
  data?: string;
}

interface PrintJob {
  printerType: 'kot' | 'bot' | 'billing';
  content: string;
  ticketId?: number;
  branchId: number;
}

class PrinterService {
  private connections: Map<string, Socket> = new Map();
  
  /**
   * Test printer connectivity
   */
  async testPrinterConnection(ipAddress: string, port: number = 9100, timeout: number = 5000): Promise<boolean> {
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
        resolve(false);
      }, timeout);

      socket.setTimeout(timeout);

      socket.connect(port, ipAddress, () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('error', () => {
        cleanup();
        clearTimeout(timer);
        resolve(false);
      });

      socket.on('timeout', () => {
        cleanup();
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Send print job to thermal printer
   */
  async sendPrintJob(ipAddress: string, content: string, port: number = 9100): Promise<boolean> {
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
      }, 10000);

      socket.connect(port, ipAddress, () => {
        try {
          // Convert content to buffer with proper encoding
          const buffer = Buffer.from(content, 'utf8');
          
          // Add cut command at the end for thermal printers
          const cutCommand = Buffer.from([0x1D, 0x56, 0x00]); // GS V 0 (partial cut)
          const fullBuffer = Buffer.concat([buffer, cutCommand]);
          
          socket.write(fullBuffer, (error) => {
            if (error) {
              cleanup();
              clearTimeout(timer);
              resolve(false);
            } else {
              // Wait a bit for the print job to complete
              setTimeout(() => {
                cleanup();
                clearTimeout(timer);
                resolve(true);
              }, 1000);
            }
          });
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

      socket.on('timeout', () => {
        cleanup();
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Get printer configuration for a specific type and branch
   */
  async getPrinterConfig(branchId: number, printerType: 'kot' | 'bot' | 'billing') {
    const [config] = await db
      .select()
      .from(printerConfigurations)
      .where(
        and(
          eq(printerConfigurations.branchId, branchId),
          eq(printerConfigurations.printerType, printerType),
          eq(printerConfigurations.isEnabled, true)
        )
      )
      .limit(1);

    return config;
  }

  /**
   * Update printer connection status
   */
  async updatePrinterStatus(configId: number, status: 'connected' | 'disconnected' | 'error', errorMessage?: string) {
    await db
      .update(printerConfigurations)
      .set({
        connectionStatus: status,
        errorMessage: errorMessage || null,
        lastTestPrint: status === 'connected' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(printerConfigurations.id, configId));
  }

  /**
   * Process print job using enhanced network bridge
   */
  async processPrintJob(printJob: PrintJob): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getPrinterConfig(printJob.branchId, printJob.printerType);
      
      if (!config) {
        return {
          success: false,
          message: `No ${printJob.printerType.toUpperCase()} printer configured for this branch`
        };
      }

      if (!config.autoDirectPrint) {
        return {
          success: false,
          message: `Direct printing is disabled for ${printJob.printerType.toUpperCase()} printer`
        };
      }

      console.log(`🖨️  Processing ${printJob.printerType.toUpperCase()} print job for ${config.printerName} at ${config.ipAddress}:${config.port || 9100}`);

      // Use the enhanced network bridge for reliable printing
      const bridgePrintJob = {
        id: `${printJob.printerType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        printerType: printJob.printerType,
        content: printJob.content,
        printerConfig: config,
        timestamp: new Date(),
        retries: 0
      };

      const result = await networkPrinterBridge.sendPrintJobToNetwork(bridgePrintJob);
      
      if (result.success) {
        console.log(`✅ ${printJob.printerType.toUpperCase()} printed successfully to ${config.printerName}`);
        return {
          success: true,
          message: `${printJob.printerType.toUpperCase()} printed successfully to ${config.printerName}`
        };
      } else {
        console.log(`❌ Failed to print ${printJob.printerType.toUpperCase()} to ${config.printerName}: ${result.message}`);
        return {
          success: false,
          message: `Failed to print ${printJob.printerType.toUpperCase()}: ${result.message}`
        };
      }
    } catch (error) {
      console.error('Print job error:', error);
      return {
        success: false,
        message: `Error processing ${printJob.printerType.toUpperCase()} print job: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate thermal printer ESC/POS commands for better formatting
   */
  generateThermalPrintContent(content: string, paperWidth: number = 80): string {
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
    };

    // Initialize printer and set encoding
    let thermalContent = commands.INIT;
    
    // Process content line by line to apply proper formatting
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('='.repeat(20))) {
        // Separator line
        thermalContent += commands.ALIGN_CENTER + '='.repeat(paperWidth === 58 ? 32 : 42) + commands.FEED;
      } else if (line.includes('KOT') || line.includes('BOT') || line.includes('BILL')) {
        // Headers
        thermalContent += commands.ALIGN_CENTER + commands.BOLD_ON + commands.DOUBLE_HEIGHT + line + commands.BOLD_OFF + commands.NORMAL + commands.FEED;
      } else if (line.includes('Room:') || line.includes('Customer:')) {
        // Important info (removed Table: since customer won't show for table orders)
        thermalContent += commands.ALIGN_LEFT + commands.BOLD_ON + line + commands.BOLD_OFF + commands.FEED;
      } else if (line.includes('*****') && (line.includes('TABLE') || line.includes('ROOM') || line.includes('TAKEAWAY'))) {
        // Location with big font and bold
        thermalContent += commands.ALIGN_CENTER + commands.BOLD_ON + commands.DOUBLE_HEIGHT + line.replace(/\*/g, '') + commands.BOLD_OFF + commands.NORMAL + commands.FEED;
      } else if (line.includes('**ORDER NOTES:**') || line.startsWith('**') && line.endsWith('**')) {
        // Bold order notes
        thermalContent += commands.ALIGN_LEFT + commands.BOLD_ON + line.replace(/\*\*/g, '') + commands.BOLD_OFF + commands.FEED;
      } else {
        // Regular content
        thermalContent += commands.ALIGN_LEFT + line + commands.FEED;
      }
    }
    
    // Add some spacing and cut
    thermalContent += commands.FEED + commands.FEED + commands.CUT;
    
    return thermalContent;
  }

  /**
   * Check if auto-print is enabled for branch
   */
  async isAutoPrintEnabled(branchId: number): Promise<boolean> {
    try {
      const [settings] = await db
        .select({ directPrintKotBot: hotelSettings.directPrintKotBot })
        .from(hotelSettings)
        .where(eq(hotelSettings.branchId, branchId))
        .limit(1);

      return settings?.directPrintKotBot || false;
    } catch (error) {
      console.error('Error checking auto-print settings:', error);
      return false;
    }
  }
}

export const printerService = new PrinterService();