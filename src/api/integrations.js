import { uploadFile, deleteFile } from './supabaseFunctions.js';
import { emailService } from '../lib/resend.js';
import { supabase } from '../lib/supabase.js';

// Core integrations using Supabase and Resend
export const Core = {
  // Email functionality
  SendEmail: emailService,
  
  // File operations
  UploadFile: uploadFile,
  UploadPrivateFile: uploadFile,
  DeleteFile: deleteFile,
  
  // File URL generation
  CreateFileSignedUrl: (bucket, path) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return data.publicUrl;
  },
  
  // Placeholder functions for compatibility
  InvokeLLM: async (data) => {
    console.log('LLM integration not implemented:', data);
    return { response: 'LLM integration not available' };
  },
  
  GenerateImage: async (data) => {
    console.log('Image generation not implemented:', data);
    return { url: 'Image generation not available' };
  },
  
  ExtractDataFromUploadedFile: async (data) => {
    console.log('File extraction not implemented:', data);
    return { data: 'File extraction not available' };
  }
};

// Export individual functions for backward compatibility
export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;






