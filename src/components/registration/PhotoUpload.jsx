import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { uploadFile } from "@/api/functions";
import { Camera, Upload, X, Check, FileText } from "lucide-react";

export default function PhotoUpload({ label, onUpload, value, required = false, guidelines = [], acceptPdf = false }) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(value || null);
  const [fileType, setFileType] = useState(null);
  const fileInputRef = useRef(null);

  // Determine if the current value is a PDF
  React.useEffect(() => {
    if (value) {
      const isPdf = value.toLowerCase().includes('.pdf') || value.toLowerCase().includes('pdf');
      setFileType(isPdf ? 'pdf' : 'image');
      setPreview(value);
    }
  }, [value]);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    setFileType(isPdf ? 'pdf' : 'image');

    setIsUploading(true);
    try {
      // Determine bucket based on file type
      const bucket = isPdf ? 'attendee-documents' : 'attendee-photos';
      
      console.log('Starting file upload:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        bucket: bucket,
        isPdf: isPdf
      });
      
      const fileUrl = await uploadFile(file, bucket);
      
      console.log('File upload successful:', fileUrl);
      
      if (!isPdf) {
        setPreview(URL.createObjectURL(file));
      } else {
        setPreview(fileUrl);
      }
      onUpload(fileUrl);
    } catch (error) {
      console.error("Upload failed - detailed error:", error);
      
      // Show user-friendly error message
      let errorMessage = "Upload failed. ";
      if (error.message?.includes('row-level security')) {
        errorMessage += "Storage access issue. Please contact support.";
      } else if (error.message?.includes('not found')) {
        errorMessage += "Storage bucket not found. Please contact support.";
      } else if (error.message?.includes('Unauthorized')) {
        errorMessage += "Permission denied. Please try again.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      
      // You could add a toast notification here if you have one
      alert(errorMessage);
    }
    setIsUploading(false);
  };

  const clearPhoto = () => {
    setPreview(null);
    setFileType(null);
    onUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const acceptTypes = acceptPdf ? "image/*,application/pdf" : "image/*";

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {guidelines.length > 0 && (
        <div className="mb-4">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c956d6c6a36ced0b9be9eb/24b7d080c_image.png"
            alt="Photo Guidelines"
            className="w-full max-w-lg mx-auto rounded-lg border"
          />
          <p className="text-sm text-gray-600 text-center mt-2">
            Please follow the photo guidelines above. Only the first example (with green checkmark) is acceptable.
          </p>
        </div>
      )}

      <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
        <CardContent className="p-6">
          {preview ? (
            <div className="text-center">
              <div className="relative inline-block">
                {fileType === 'pdf' ? (
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 bg-red-50 rounded-lg border flex items-center justify-center">
                      <FileText className="w-16 h-16 text-red-600" />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">PDF Document</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(preview, '_blank')}
                      className="mt-2"
                    >
                      Review PDF
                    </Button>
                  </div>
                ) : (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border"
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                  onClick={clearPhoto}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-green-600 mt-2 font-medium">
                {fileType === 'pdf' ? 'PDF uploaded successfully' : 'Photo uploaded successfully'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {acceptPdf ? 'Upload a clear photo or PDF document' : 'Upload a clear photo'}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? 'Uploading...' : 'Choose File'}
              </Button>
              {acceptPdf && (
                <p className="text-xs text-gray-500 mt-2">Accepts images (JPG, PNG) or PDF documents</p>
              )}
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>
    </div>
  );
}