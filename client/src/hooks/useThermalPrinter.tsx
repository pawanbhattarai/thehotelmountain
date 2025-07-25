/**
 * React Hook for Thermal Printer Integration in PWA
 * Supports multiple connection methods for cross-platform printing
 */

import { useState, useEffect, useCallback } from 'react';
import { printerBridge, PrinterConnection, PrintJob } from '../lib/printer-bridge';
import { useToast } from './use-toast';

export interface UseThermalPrinterReturn {
  // Connection status
  isConnected: boolean;
  isConnecting: boolean;
  connections: PrinterConnection[];
  
  // Connection methods
  connectBluetooth: () => Promise<void>;
  connectSerial: () => Promise<void>;
  connectNetwork: (ipAddress: string, port?: number) => Promise<void>;
  autoConnect: (printerConfig?: any) => Promise<void>;
  disconnect: (type?: string) => Promise<void>;
  
  // Printing
  print: (job: PrintJob) => Promise<boolean>;
  isPrinting: boolean;
  
  // Capabilities
  capabilities: {
    bluetooth: boolean;
    serial: boolean;
    network: boolean;
  };
}

export function useThermalPrinter(): UseThermalPrinterReturn {
  const [connections, setConnections] = useState<PrinterConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [capabilities, setCapabilities] = useState({
    bluetooth: false,
    serial: false,
    network: true, // Always available via fetch API
  });
  
  const { toast } = useToast();

  // Detect browser capabilities on mount
  useEffect(() => {
    setCapabilities({
      bluetooth: 'bluetooth' in navigator,
      serial: 'serial' in navigator,
      network: true,
    });
  }, []);

  // Update connections when bridge state changes
  const refreshConnections = useCallback(() => {
    setConnections(printerBridge.getConnections());
  }, []);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  const connectBluetooth = useCallback(async () => {
    if (!capabilities.bluetooth) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Web Bluetooth API",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      await printerBridge.connectBluetooth();
      refreshConnections();
      toast({
        title: "Bluetooth Connected",
        description: "Successfully connected to Bluetooth printer",
      });
    } catch (error: any) {
      console.error('Bluetooth connection failed:', error);
      toast({
        title: "Bluetooth Connection Failed",
        description: error.message || "Could not connect to Bluetooth printer",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [capabilities.bluetooth, toast, refreshConnections]);

  const connectSerial = useCallback(async () => {
    if (!capabilities.serial) {
      toast({
        title: "Serial Not Supported",
        description: "Your browser doesn't support Web Serial API",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      await printerBridge.connectSerial();
      refreshConnections();
      toast({
        title: "USB Printer Connected",
        description: "Successfully connected to USB thermal printer",
      });
    } catch (error: any) {
      console.error('Serial connection failed:', error);
      toast({
        title: "USB Connection Failed", 
        description: error.message || "Could not connect to USB printer",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [capabilities.serial, toast, refreshConnections]);

  const connectNetwork = useCallback(async (ipAddress: string, port: number = 9100) => {
    setIsConnecting(true);
    try {
      await printerBridge.connectNetwork(ipAddress, port);
      refreshConnections();
      toast({
        title: "Network Printer Connected",
        description: `Successfully connected to printer at ${ipAddress}:${port}`,
      });
    } catch (error: any) {
      console.error('Network connection failed:', error);
      toast({
        title: "Network Connection Failed",
        description: error.message || "Could not connect to network printer",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast, refreshConnections]);

  const autoConnect = useCallback(async (printerConfig?: any) => {
    setIsConnecting(true);
    try {
      await printerBridge.autoConnect(printerConfig);
      refreshConnections();
      toast({
        title: "Printer Connected",
        description: "Successfully auto-connected to printer",
      });
    } catch (error: any) {
      console.error('Auto-connect failed:', error);
      toast({
        title: "Auto-Connection Failed",
        description: error.message || "Could not connect to any available printer",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast, refreshConnections]);

  const disconnect = useCallback(async (type?: string) => {
    try {
      await printerBridge.disconnect(type);
      refreshConnections();
      toast({
        title: "Printer Disconnected",
        description: type ? `Disconnected from ${type} printer` : "Disconnected from all printers",
      });
    } catch (error: any) {
      console.error('Disconnect failed:', error);
      toast({
        title: "Disconnect Failed",
        description: error.message || "Could not disconnect from printer",
        variant: "destructive",
      });
    }
  }, [toast, refreshConnections]);

  const print = useCallback(async (job: PrintJob): Promise<boolean> => {
    setIsPrinting(true);
    try {
      const success = await printerBridge.print(job);
      
      if (success) {
        toast({
          title: "Print Successful",
          description: `${job.type.toUpperCase()} printed successfully`,
        });
      } else {
        toast({
          title: "Print Failed",
          description: "Could not print to thermal printer",
          variant: "destructive",
        });
      }
      
      return success;
    } catch (error: any) {
      console.error('Print failed:', error);
      toast({
        title: "Print Error",
        description: error.message || "Printing failed",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsPrinting(false);
    }
  }, [toast]);

  return {
    // Connection status
    isConnected: printerBridge.isConnected(),
    isConnecting,
    connections,
    
    // Connection methods
    connectBluetooth,
    connectSerial,
    connectNetwork,
    autoConnect,
    disconnect,
    
    // Printing
    print,
    isPrinting,
    
    // Capabilities
    capabilities,
  };
}

// Utility function to format order data for thermal printing
export function formatKitchenOrder(order: any, items: any[]): string {
  const lines = [];
  
  lines.push(`Table: ${order.tableNumber || order.roomNumber || 'N/A'}`);
  lines.push(`Order #: ${order.orderNumber || order.id}`);
  lines.push(`Time: ${new Date().toLocaleTimeString()}`);
  lines.push('');
  lines.push('=====================================');
  lines.push('KITCHEN ORDER');
  lines.push('=====================================');
  lines.push('');
  
  items.forEach(item => {
    if (item.category === 'food' || item.dishType === 'food') {
      lines.push(`${item.quantity}x ${item.dishName || item.name}`);
      if (item.notes) {
        lines.push(`   Note: ${item.notes}`);
      }
      lines.push('');
    }
  });
  
  lines.push('=====================================');
  lines.push(`Guest: ${order.guestName || 'Walk-in'}`);
  lines.push(`Phone: ${order.guestPhone || 'N/A'}`);
  
  return lines.join('\n');
}

export function formatBeverageOrder(order: any, items: any[]): string {
  const lines = [];
  
  lines.push(`Table: ${order.tableNumber || order.roomNumber || 'N/A'}`);
  lines.push(`Order #: ${order.orderNumber || order.id}`);
  lines.push(`Time: ${new Date().toLocaleTimeString()}`);
  lines.push('');
  lines.push('=====================================');
  lines.push('BEVERAGE ORDER');
  lines.push('=====================================');
  lines.push('');
  
  items.forEach(item => {
    if (item.category === 'beverage' || item.dishType === 'beverage') {
      lines.push(`${item.quantity}x ${item.dishName || item.name}`);
      if (item.notes) {
        lines.push(`   Note: ${item.notes}`);
      }
      lines.push('');
    }
  });
  
  lines.push('=====================================');
  lines.push(`Guest: ${order.guestName || 'Walk-in'}`);
  lines.push(`Phone: ${order.guestPhone || 'N/A'}`);
  
  return lines.join('\n');
}

export function formatReceipt(order: any, items: any[], totalAmount: number): string {
  const lines = [];
  
  lines.push('=====================================');
  lines.push('RECEIPT');
  lines.push('=====================================');
  lines.push('');
  lines.push(`Table: ${order.tableNumber || order.roomNumber || 'N/A'}`);
  lines.push(`Order #: ${order.orderNumber || order.id}`);
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  lines.push(`Time: ${new Date().toLocaleTimeString()}`);
  lines.push('');
  lines.push('-------------------------------------');
  lines.push('Items:');
  lines.push('-------------------------------------');
  
  let subtotal = 0;
  items.forEach(item => {
    const itemTotal = item.quantity * item.price;
    subtotal += itemTotal;
    lines.push(`${item.quantity}x ${item.dishName || item.name}`);
    lines.push(`    Rs. ${item.price.toFixed(2)} x ${item.quantity} = Rs. ${itemTotal.toFixed(2)}`);
  });
  
  lines.push('');
  lines.push('-------------------------------------');
  lines.push(`Subtotal: Rs. ${subtotal.toFixed(2)}`);
  
  if (order.tax) {
    lines.push(`Tax: Rs. ${order.tax.toFixed(2)}`);
  }
  
  if (order.discount) {
    lines.push(`Discount: Rs. ${order.discount.toFixed(2)}`);
  }
  
  lines.push('-------------------------------------');
  lines.push(`TOTAL: Rs. ${totalAmount.toFixed(2)}`);
  lines.push('=====================================');
  lines.push('');
  lines.push('Thank you for your business!');
  lines.push('');
  
  return lines.join('\n');
}