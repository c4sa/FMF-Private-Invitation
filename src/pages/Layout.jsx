
import React from 'react';
import AuthenticatedLayout from '../components/layouts/AuthenticatedLayout';
import { Toaster } from '../components/ui/toaster';

export default function Layout({ children, currentPageName }) {
  // List of pages that should NOT have the main authenticated layout
  const publicPages = ['PublicRegistration', 'ProfileSetup', 'Login', 'Signup', 'ResetPassword', 'VerifyOtp'];

  if (publicPages.includes(currentPageName)) {
    return (
      <>
        <div className="bg-slate-50 min-h-screen">
          {children}
        </div>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <AuthenticatedLayout currentPageName={currentPageName}>
        {children}
      </AuthenticatedLayout>
      <Toaster />
    </>
  );
}
