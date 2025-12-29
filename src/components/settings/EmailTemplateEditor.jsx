
import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from 'lucide-react';
import { EmailTemplate } from '@/api/entities';
import { Badge } from '@/components/ui/badge';
import { useToast } from '../common/Toast'; // Added import for useToast

const modules = {
  toolbar: [
    [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
    [{size: []}],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, 
     {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'image', 'video'],
    ['clean'],
    [{ 'color': [] }, { 'background': [] }],
  ],
};

export default function EmailTemplateEditor({ template, onSave }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [bccRecipients, setBccRecipients] = useState(template.bcc_recipients || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast(); // Initialized useToast

  const placeholders = template.description?.match(/{{[a-zA-Z_]+}}/g) || [];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await EmailTemplate.update(template.id, { subject, body, bcc_recipients: bccRecipients });
      onSave({ ...template, subject, body, bcc_recipients: bccRecipients });
      toast({ // Replaced alert with toast for success
        title: "Success",
        description: `'${template.name}' template saved successfully!`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({ // Replaced alert with toast for error
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize text-xl">{template.name} Email Template</CardTitle>
        <CardDescription>
          Customize the email sent for this action.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor={`subject-${template.name}`}>Email Subject</Label>
          <Input
            id={`subject-${template.name}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <Label>Email Body</Label>
          <div className="bg-white rounded-md border">
            <ReactQuill
              theme="snow"
              value={body}
              onChange={setBody}
              modules={modules}
            />
          </div>
        </div>
        
        <div>
            <Label className="text-sm font-medium">Available Placeholders</Label>
            <div className="flex flex-wrap gap-2 mt-2">
                {placeholders.map(p => (
                    <Badge key={p} variant="secondary" className="font-mono">{p}</Badge>
                ))}
            </div>
        </div>

        <div>
          <Label htmlFor={`bcc-${template.name}`}>
            BCC Recipients (Optional)
          </Label>
          <Input
            id={`bcc-${template.name}`}
            value={bccRecipients}
            onChange={(e) => setBccRecipients(e.target.value)}
            placeholder="email1@example.com, email2@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Separate multiple emails with commas. These recipients will receive a copy of all emails sent using this template.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Saving...
              </div>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
