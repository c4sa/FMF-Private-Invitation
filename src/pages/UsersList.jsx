import React, { useState, useEffect, useCallback } from 'react';
import { StagedUser } from '@/api/entities';
import { uploadFile } from '@/api/functions';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Users, Trash2, FileUp } from 'lucide-react';
import { useToast } from '../components/common/Toast';


export default function UsersListPage() {
  const [stagedUsers, setStagedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const loadStagedUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await StagedUser.list('-created_at');
      setStagedUsers(data);
    } catch (error) {
      console.error("Error loading staged users:", error);
      toast({ title: "Error", description: "Failed to load users list.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadStagedUsers();
  }, [loadStagedUsers]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      toast({ title: "Processing File", description: "Processing CSV file. This may take a moment." });
      
      // Read and parse CSV file
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have at least a header row and one data row.");
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['name', 'email', 'username', 'initial_password'];
      
      // Check if all required headers are present
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Parse data rows
      const usersToCreate = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= requiredHeaders.length) {
          const user = {
            name: values[headers.indexOf('name')] || '',
            company: values[headers.indexOf('company')] || '',
            email: values[headers.indexOf('email')] || '',
            username: values[headers.indexOf('username')] || '',
            initial_password: values[headers.indexOf('initial_password')] || ''
          };
          
          // Validate required fields
          if (user.name && user.email && user.username && user.initial_password) {
            usersToCreate.push(user);
          }
        }
      }

      if (usersToCreate.length > 0) {
        await StagedUser.bulkCreate(usersToCreate);
        toast({ title: "Success", description: `${usersToCreate.length} users have been added to the list.`, variant: "success" });
        loadStagedUsers();
      } else {
        toast({ title: "No Data", description: "The file was processed, but no valid user data was found.", variant: "warning" });
      }

    } catch (error) {
      console.error("File processing failed:", error);
      toast({ title: "Upload Failed", description: error.message || "An error occurred during file processing.", variant: "destructive" });
    }
    setIsUploading(false);
  };

  const handleToggleAssigned = async (userId, currentState) => {
    try {
      await StagedUser.update(userId, { is_assigned: !currentState });
      setStagedUsers(prev => prev.map(u => u.id === userId ? { ...u, is_assigned: !currentState } : u));
    } catch (error) {
      console.error("Failed to update status:", error);
      toast({ title: "Error", description: "Could not update the assigned status.", variant: "destructive" });
    }
  };
  
  const handleClearList = async () => {
      if (!window.confirm("Are you sure you want to delete all users from this list? This action cannot be undone.")) {
          return;
      }
      
      try {
          // The SDK doesn't have a bulk delete, so we delete one by one.
          // For a large number of records, a backend function would be more efficient.
          await Promise.all(stagedUsers.map(user => StagedUser.delete(user.id)));
          toast({ title: "List Cleared", description: "All users have been removed from the list.", variant: "success" });
          setStagedUsers([]);
      } catch (error) {
          console.error("Failed to clear list:", error);
          toast({ title: "Error", description: "Failed to clear the list.", variant: "destructive" });
      }
  };

  return (
    <ProtectedRoute adminOnly>
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Users List</h1>
              <p className="text-gray-500 mt-1">Upload and manage a list of users with initial credentials.</p>
            </div>
             <div className="flex gap-3">
                 <Button variant="destructive" onClick={handleClearList} disabled={stagedUsers.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear List
                </Button>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <FileUp className="w-4 h-4 mr-2" />
                        {isUploading ? "Processing..." : "Upload CSV File"}
                    </label>
                </Button>
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".csv" disabled={isUploading}/>
            </div>
          </div>
          
          <Card>
             <CardHeader>
                  <CardTitle>Staged Users ({stagedUsers.length})</CardTitle>
                  <CardDescription>
                      Upload a CSV file with columns: name, company, email, username, initial_password.
                  </CardDescription>
              </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[50px]">Assigned</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Initial Password</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-24">Loading...</TableCell></TableRow>
                    ) : stagedUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center h-24">No users found. Upload a file to get started.</TableCell></TableRow>
                    ) : (
                      stagedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={user.is_assigned}
                              onCheckedChange={() => handleToggleAssigned(user.id, user.is_assigned)}
                            />
                          </TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.company}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell className="font-mono">{user.initial_password}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}