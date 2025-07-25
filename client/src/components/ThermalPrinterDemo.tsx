/**
 * Thermal Printer Demo Component
 * Demonstrates all printing methods for the PWA
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  useThermalPrinter, 
  formatKitchenOrder, 
  formatBeverageOrder, 
  formatReceipt 
} from '../hooks/useThermalPrinter';
import { 
  Bluetooth, 
  Usb, 
  Wifi, 
  Printer, 
  Zap, 
  CheckCircle, 
  XCircle,
  AlertCircle
} from 'lucide-react';

export function ThermalPrinterDemo() {
  const {
    isConnected,
    isConnecting,
    connections,
    connectBluetooth,
    connectSerial,
    connectNetwork,
    autoConnect,
    disconnect,
    print,
    isPrinting,
    capabilities
  } = useThermalPrinter();

  const [networkConfig, setNetworkConfig] = useState({
    ipAddress: '192.168.1.100',
    port: 9100
  });

  const [customContent, setCustomContent] = useState('Test print from PWA\nDirect thermal printing\nWorking correctly!');

  // Sample order data for demonstration
  const sampleOrder = {
    id: 'ORD001',
    tableNumber: 'T5',
    orderNumber: 'KT001',
    guestName: 'John Doe',
    guestPhone: '+977-9841234567'
  };

  const sampleItems = [
    {
      quantity: 2,
      dishName: 'Chicken Momo',
      category: 'food',
      price: 150,
      notes: 'Extra spicy'
    },
    {
      quantity: 1,
      dishName: 'Coca Cola',
      category: 'beverage', 
      price: 80
    },
    {
      quantity: 1,
      dishName: 'Dal Bhat',
      category: 'food',
      price: 200
    }
  ];

  const handleNetworkConnect = async () => {
    await connectNetwork(networkConfig.ipAddress, networkConfig.port);
  };

  const handleAutoConnect = async () => {
    // Use the configured printer settings from the system
    await autoConnect({
      ipAddress: networkConfig.ipAddress,
      port: networkConfig.port
    });
  };

  const handleTestPrint = async (type: 'kot' | 'bot' | 'receipt' | 'custom') => {
    let content = '';
    
    switch (type) {
      case 'kot':
        content = formatKitchenOrder(sampleOrder, sampleItems);
        break;
      case 'bot':
        content = formatBeverageOrder(sampleOrder, sampleItems);
        break;
      case 'receipt':
        content = formatReceipt(sampleOrder, sampleItems, 580);
        break;
      case 'custom':
        content = customContent;
        break;
    }

    await print({
      type,
      content,
      copies: 1
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            PWA Thermal Printer Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Connection Status */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {isConnected ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
              </div>
              <div className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-xs text-muted-foreground">
                {connections.length} active connections
              </div>
            </div>

            {/* Browser Capabilities */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Bluetooth className={`h-4 w-4 ${capabilities.bluetooth ? 'text-blue-500' : 'text-gray-400'}`} />
                <Usb className={`h-4 w-4 ${capabilities.serial ? 'text-green-500' : 'text-gray-400'}`} />
                <Wifi className={`h-4 w-4 ${capabilities.network ? 'text-purple-500' : 'text-gray-400'}`} />
              </div>
              <div className="text-sm font-medium">Browser Support</div>
              <div className="text-xs text-muted-foreground">
                {Object.values(capabilities).filter(Boolean).length}/3 methods
              </div>
            </div>

            {/* Quick Actions */}
            <div className="text-center">
              <Button 
                onClick={handleAutoConnect}
                disabled={isConnecting || isConnected}
                className="mb-2 w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Auto Connect'}
              </Button>
              {isConnected && (
                <Button 
                  variant="outline" 
                  onClick={() => disconnect()}
                  className="w-full"
                >
                  Disconnect All
                </Button>
              )}
            </div>
          </div>

          {/* Active Connections */}
          {connections.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3">Active Connections</h4>
              <div className="space-y-2">
                {connections.map((conn, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {conn.type === 'bluetooth' && <Bluetooth className="h-4 w-4 text-blue-500" />}
                      {conn.type === 'serial' && <Usb className="h-4 w-4 text-green-500" />}
                      {conn.type === 'network' && <Wifi className="h-4 w-4 text-purple-500" />}
                      <span className="font-medium">{conn.name}</span>
                      <Badge variant={conn.connected ? 'default' : 'destructive'}>
                        {conn.connected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => disconnect(conn.type)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Tabs defaultValue="connect" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connect">Connect</TabsTrigger>
              <TabsTrigger value="test">Test Print</TabsTrigger>
              <TabsTrigger value="custom">Custom Print</TabsTrigger>
            </TabsList>

            <TabsContent value="connect" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Bluetooth Connection */}
                <Card className={capabilities.bluetooth ? '' : 'opacity-50'}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bluetooth className="h-4 w-4" />
                      Bluetooth
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect to Bluetooth thermal printers directly from mobile devices
                    </p>
                    <Button 
                      onClick={connectBluetooth}
                      disabled={!capabilities.bluetooth || isConnecting}
                      className="w-full"
                    >
                      {capabilities.bluetooth ? 'Connect Bluetooth' : 'Not Supported'}
                    </Button>
                    {!capabilities.bluetooth && (
                      <p className="text-xs text-yellow-600">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Web Bluetooth not available in this browser
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* USB/Serial Connection */}
                <Card className={capabilities.serial ? '' : 'opacity-50'}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Usb className="h-4 w-4" />
                      USB Serial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect to USB thermal printers on desktop computers
                    </p>
                    <Button 
                      onClick={connectSerial}
                      disabled={!capabilities.serial || isConnecting}
                      className="w-full"
                    >
                      {capabilities.serial ? 'Connect USB' : 'Not Supported'}
                    </Button>
                    {!capabilities.serial && (
                      <p className="text-xs text-yellow-600">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Web Serial only available on desktop Chrome/Edge
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Network Connection */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Network TCP/IP
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="ip">IP Address</Label>
                      <Input
                        id="ip"
                        value={networkConfig.ipAddress}
                        onChange={(e) => setNetworkConfig(prev => ({ ...prev, ipAddress: e.target.value }))}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={networkConfig.port}
                        onChange={(e) => setNetworkConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                        placeholder="9100"
                      />
                    </div>
                    <Button 
                      onClick={handleNetworkConnect}
                      disabled={isConnecting}
                      className="w-full"
                    >
                      Connect Network
                    </Button>
                    <p className="text-xs text-green-600">
                      <CheckCircle className="h-3 w-3 inline mr-1" />
                      Works on all devices via cloud proxy
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button 
                  onClick={() => handleTestPrint('kot')}
                  disabled={!isConnected || isPrinting}
                  className="h-20 flex-col"
                >
                  <Printer className="h-6 w-6 mb-2" />
                  KOT Print
                </Button>

                <Button 
                  onClick={() => handleTestPrint('bot')}
                  disabled={!isConnected || isPrinting}
                  className="h-20 flex-col"
                  variant="outline"
                >
                  <Printer className="h-6 w-6 mb-2" />
                  BOT Print
                </Button>

                <Button 
                  onClick={() => handleTestPrint('receipt')}
                  disabled={!isConnected || isPrinting}
                  className="h-20 flex-col"
                  variant="outline"
                >
                  <Printer className="h-6 w-6 mb-2" />
                  Receipt
                </Button>

                <Button 
                  onClick={() => handleTestPrint('custom')}
                  disabled={!isConnected || isPrinting}
                  className="h-20 flex-col"
                  variant="outline"
                >
                  <Printer className="h-6 w-6 mb-2" />
                  Custom
                </Button>
              </div>

              {isPrinting && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    Printing...
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="content">Custom Print Content</Label>
                  <Textarea
                    id="content"
                    value={customContent}
                    onChange={(e) => setCustomContent(e.target.value)}
                    rows={8}
                    placeholder="Enter custom content to print..."
                    className="font-mono text-sm"
                  />
                </div>
                
                <Button 
                  onClick={() => handleTestPrint('custom')}
                  disabled={!isConnected || isPrinting}
                  className="w-full"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {isPrinting ? 'Printing...' : 'Print Custom Content'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}