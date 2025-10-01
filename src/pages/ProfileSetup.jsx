
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User as UserIcon, Save, Building } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ProfileSetup() {
  const [user, setUser] = useState(null);
  const [preferredName, setPreferredName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        // If they already have a preferred name, they don't need to be here.
        if (currentUser.preferred_name) {
          navigate(createPageUrl('Dashboard'));
        }
      } catch (error) {
        // If not logged in, redirect to login page
        window.location.href = '/login';
      }
    };
    fetchUser();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!preferredName || !companyName) {
      alert('Please enter your preferred name and company name.');
      return;
    }
    setIsSaving(true);
    try {
      await User.updateMyUserData({ preferred_name: preferredName, company_name: companyName });
      // On success, redirect to the main dashboard
      navigate(createPageUrl('Dashboard'));
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to save your profile. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription>
            Welcome! As a first-time user, please set your preferred name and company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredName">Preferred Name</Label>
              <Input
                id="preferredName"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="e.g., John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., C4"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
              {isSaving ? 'Saving...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save and Continue
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
