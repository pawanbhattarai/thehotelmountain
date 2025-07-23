import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download, RefreshCw, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeModalProps {
  type: 'table' | 'room';
  id: number;
  name: string;
  children?: React.ReactNode;
}

export function QRCodeModal({ type, id, name, children }: QRCodeModalProps) {
  const [open, setOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateQR = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/qr/${type}/${id}`);
      if (!response.ok) throw new Error('Failed to generate QR code');
      
      const data = await response.json();
      setQrCode(data.qrCode);
      setQrUrl(data.url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const regenerateQR = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/qr/${type}/${id}/regenerate`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to regenerate QR code');
      
      const data = await response.json();
      setQrCode(data.qrCode);
      
      toast({
        title: "Success",
        description: "QR code regenerated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate QR code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrCode) return;
    
    const link = document.createElement('a');
    link.download = `${type}-${name.replace(/\s+/g, '-')}-qr.png`;
    link.href = qrCode;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Downloaded",
      description: "QR code image downloaded",
    });
  };

  const copyUrl = async () => {
    if (!qrUrl) return;
    
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast({
        title: "Copied",
        description: "QR code URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !qrCode) {
      generateQR();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for {name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : qrCode ? (
              <div className="space-y-4">
                <img 
                  src={qrCode} 
                  alt={`QR Code for ${name}`}
                  className="mx-auto border rounded-lg"
                />
                <p className="text-sm text-gray-600">
                  Guests can scan this QR code to place orders directly from {name}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Click generate to create QR code</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQR}
              disabled={!qrCode}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={copyUrl}
              disabled={!qrUrl}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateQR}
              disabled={!qrCode || loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          </div>

          {qrUrl && (
            <div className="text-xs text-gray-500 break-all p-2 bg-gray-50 rounded">
              {qrUrl}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}