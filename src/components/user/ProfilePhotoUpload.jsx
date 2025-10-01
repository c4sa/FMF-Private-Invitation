import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadFile } from "@/api/functions";
import { Camera, Upload, X, Check } from "lucide-react";

export default function ProfilePhotoUpload({ currentUser, onPhotoUpdate }) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(currentUser?.avatar_url || null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileUrl = await uploadFile(file, 'attendee-photos');
      setPreview(URL.createObjectURL(file));
      onPhotoUpdate(fileUrl);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload photo. Please try again.");
    }
    setIsUploading(false);
  };

  const clearPhoto = () => {
    setPreview(null);
    onPhotoUpdate(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profile Photo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-24 h-24">
            <AvatarImage src={preview} />
            <AvatarFallback className="bg-gray-100 text-gray-600 text-xl font-semibold">
              {currentUser?.preferred_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
               currentUser?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
               'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex gap-2">
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
                <Camera className="w-4 h-4" />
              )}
              {isUploading ? 'Uploading...' : (preview ? 'Change Photo' : 'Add Photo')}
            </Button>

            {preview && (
              <Button
                type="button"
                variant="outline"
                onClick={clearPhoto}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <p className="text-sm text-gray-500 text-center">
            Upload a profile photo. Supports JPG, PNG (max 2MB)
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}