import React from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import EmailTemplateEditor from '@/components/settings/EmailTemplateEditor';
import EmailActivationSettings from '@/components/settings/EmailActivationSettings';
import ModuleActivationSettings from '@/components/settings/ModuleActivationSettings'; // Import new component
import { Mail, Power } from 'lucide-react';
import { EmailTemplate } from '@/api/entities';
import { useToast } from '../components/common/Toast';

export default function SettingsPage() {
  const [templates, setTemplates] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  const loadTemplates = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await EmailTemplate.list();
      
      // Filter out 'test' templates and get unique templates (latest version of each name)
      const filteredTemplates = data.filter(template => template.name !== 'test');

      // Get the latest version of each template by name
      const uniqueTemplatesMap = new Map();
      filteredTemplates.forEach(template => {
        if (!uniqueTemplatesMap.has(template.name) || 
            new Date(template.created_at) > new Date(uniqueTemplatesMap.get(template.name).created_at)) {
          uniqueTemplatesMap.set(template.name, template);
        }
      });
      const uniqueTemplates = Array.from(uniqueTemplatesMap.values());

      setTemplates(uniqueTemplates.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error loading email templates:", error);
      toast({
        title: "Error",
        description: "Failed to load email templates. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSave = (updatedTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
    toast({
      title: "Success",
      description: `'${updatedTemplate.name}' template saved successfully!`,
      variant: "success",
    });
  };

  return (
    <ProtectedRoute adminOnly>
      <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <SettingsIcon className="w-8 h-8 text-gray-800" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
              <p className="text-gray-500 mt-1">Manage global system configurations.</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Module Activation - First priority */}
            <ModuleActivationSettings />
            
            {/* Email Settings */}
            <EmailActivationSettings />
            
            {/* Email Templates */}
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {templates.map(template => (
                  <EmailTemplateEditor key={template.id} template={template} onSave={handleSave} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Helper icon to avoid import conflicts if Settings is already defined.
const SettingsIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);