import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Eye, FileText, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
  label?: string;
  currentFile?: {
    fileUrl: string;
    originalName: string;
    size: number;
    mimeType: string;
  };
  onRemove?: () => void;
  disabled?: boolean;
  isUploading?: boolean;
  uploadSuccess?: boolean;
}

export function FileUpload({
  onFileSelect,
  accept = "image/*,.pdf",
  maxSize = 5,
  label = "Upload File",
  currentFile,
  onRemove,
  disabled = false,
  isUploading = false,
  uploadSuccess = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxSize}MB`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFileName(file.name);
    onFileSelect(file);
    toast({
      title: "File selected",
      description: `${file.name} is ready to upload`,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    } else {
      setSelectedFileName("");
    }
  };

  const handleViewFile = () => {
    if (currentFile?.fileUrl) {
      // Open file in new tab
      window.open(currentFile.fileUrl, "_blank");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {currentFile ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getFileIcon(currentFile.mimeType)}
                <div>
                  <p className="text-sm font-medium">
                    {currentFile.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(currentFile.size)}
                  </p>
                  <p className="text-xs text-green-600 font-medium">
                    ✓ Uploaded successfully
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleViewFile}
                  className="h-8 px-2"
                >
                  <Eye className="h-3 w-3" />
                  View
                </Button>
                {onRemove && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRemove}
                    className="h-8 px-2 text-red-600 hover:text-red-700"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : selectedFileName && !currentFile ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{selectedFileName}</p>
                  <p className="text-xs text-blue-600 font-medium">
                    {isUploading
                      ? "🔄 Uploading..."
                      : "📁 Selected - Ready to upload"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedFileName("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="h-8 px-2 text-gray-600 hover:text-gray-700"
                disabled={disabled || isUploading}
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <Label>{label}</Label>
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5"}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">
              Drop your file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {maxSize}MB • Accepted: {accept}
            </p>
          </div>
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
