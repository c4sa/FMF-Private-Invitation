import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PartnershipType } from '@/api/entities';
import { useToast } from '@/components/common/Toast';
import { Plus, Edit3, Trash2, Search } from 'lucide-react';

export default function PartnershipManagementPage() {
  const [partnerTypes, setPartnerTypes] = useState([]);
  const [filteredPartnerTypes, setFilteredPartnerTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slots_vip: 0,
    slots_premier: 0,
    slots_partner: 0,
    slots_exhibitor: 0,
    slots_media: 0,
    slots_other: 0
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);
  const { toast } = useToast();

  const loadTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await PartnershipType.list('-created_at');
      setPartnerTypes(data);
      setFilteredPartnerTypes(data);
    } catch (error) {
      console.error("Failed to load partnership types:", error);
      toast({ title: "Error", description: "Could not load partnership types.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const applyFilters = useCallback(() => {
    let filtered = [...partnerTypes];

    if (searchTerm) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(type => {
        const name = type.name || '';
        const slotsVip = String(type.slots_vip || 0);
        const slotsPremier = String(type.slots_premier || 0);
        const slotsPartner = String(type.slots_partner || 0);
        const slotsExhibitor = String(type.slots_exhibitor || 0);
        const slotsMedia = String(type.slots_media || 0);
        const slotsOther = String(type.slots_other || 0);
        
        return (
          name.toLowerCase().includes(lowercasedSearch) ||
          slotsVip.includes(lowercasedSearch) ||
          slotsPremier.includes(lowercasedSearch) ||
          slotsPartner.includes(lowercasedSearch) ||
          slotsExhibitor.includes(lowercasedSearch) ||
          slotsMedia.includes(lowercasedSearch) ||
          slotsOther.includes(lowercasedSearch)
        );
      });
    }

    setFilteredPartnerTypes(filtered);
  }, [partnerTypes, searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const resetForm = () => {
    setEditingType(null);
    setFormData({ name: '', slots_vip: 0, slots_premier: 0, slots_partner: 0, slots_exhibitor: 0, slots_media: 0, slots_other: 0 });
  };

  const handleAddNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      slots_vip: type.slots_vip || 0,
      slots_premier: type.slots_premier || 0,
      slots_partner: type.slots_partner || 0,
      slots_exhibitor: type.slots_exhibitor || 0,
      slots_media: type.slots_media || 0,
      slots_other: type.slots_other || 0
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Validation Error", description: "Partnership type name is required.", variant: "destructive" });
      return;
    }

    try {
      if (editingType) {
        await PartnershipType.update(editingType.id, formData);
        toast({ title: "Success", description: "Partnership type updated and user slots synchronized.", variant: "success" });
      } else {
        await PartnershipType.create(formData);
        toast({ title: "Success", description: "New partnership type created.", variant: "success" });
      }
      setShowDialog(false);
      resetForm();
      loadTypes();
    } catch (error) {
      console.error("Failed to save partnership type:", error);
      toast({ title: "Error", description: "Failed to save partnership type.", variant: "destructive" });
    }
  };

  const confirmDelete = (type) => {
    setTypeToDelete(type);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await PartnershipType.delete(typeToDelete.id);
      toast({ title: "Success", description: "Partnership type deleted and user slots reset.", variant: "success" });
      setShowDeleteConfirm(false);
      setTypeToDelete(null);
      loadTypes();
    } catch (error) {
      console.error("Failed to delete partnership type:", error);
      toast({ title: "Error", description: "Failed to delete partnership type.", variant: "destructive" });
    }
  };

  return (
    <ProtectedRoute adminOnly pageName="PartnershipManagement">
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Partnership Management</h1>
              <p className="text-gray-500 mt-1">Define partnership types and their default registration slot allocations.</p>
            </div>
            <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Type
            </Button>
          </div>

          {/* Search Filter */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by partnership type name or slot values"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Partnership Types {filteredPartnerTypes.length !== partnerTypes.length && `(${filteredPartnerTypes.length})`}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type Name</TableHead>
                      <TableHead className="text-center">VIP Slots</TableHead>
                      <TableHead className="text-center">Premier Slots</TableHead>
                      <TableHead className="text-center">Partner Slots</TableHead>
                      <TableHead className="text-center">Exhibitor Slots</TableHead>
                      <TableHead className="text-center">Media Slots</TableHead>
                      <TableHead className="text-center">Other Slots</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={8} className="text-center h-24">Loading...</TableCell></TableRow>
                    ) : filteredPartnerTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-gray-500">
                          {searchTerm ? 'No partnership types found matching your search.' : 'No partnership types found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPartnerTypes.map(type => (
                        <TableRow key={type.id}>
                          <TableCell className="font-semibold">{type.name}</TableCell>
                          <TableCell className="text-center">{type.slots_vip}</TableCell>
                          <TableCell className="text-center">{type.slots_premier}</TableCell>
                          <TableCell className="text-center">{type.slots_partner}</TableCell>
                          <TableCell className="text-center">{type.slots_exhibitor}</TableCell>
                          <TableCell className="text-center">{type.slots_media}</TableCell>
                          <TableCell className="text-center">{type.slots_other}</TableCell>
                          <TableCell className="flex gap-2">
                             <Button size="sm" variant="outline" onClick={() => handleEdit(type)}>
                                <Edit3 className="w-4 h-4" />
                             </Button>
                             <Button size="sm" variant="destructive" onClick={() => confirmDelete(type)}>
                                <Trash2 className="w-4 h-4" />
                             </Button>
                          </TableCell>
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit' : 'Add New'} Partnership Type</DialogTitle>
            <DialogDescription>
              {editingType ? 'Update the details for this partnership type.' : 'Create a new type and set its default slot allocations.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Type Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slots_vip">VIP Slots</Label>
                <Input id="slots_vip" type="number" min="0" value={formData.slots_vip} onChange={(e) => setFormData({...formData, slots_vip: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <Label htmlFor="slots_premier">Premier Slots</Label>
                <Input id="slots_premier" type="number" min="0" value={formData.slots_premier} onChange={(e) => setFormData({...formData, slots_premier: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <Label htmlFor="slots_partner">Partner Slots</Label>
                <Input id="slots_partner" type="number" min="0" value={formData.slots_partner} onChange={(e) => setFormData({...formData, slots_partner: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <Label htmlFor="slots_exhibitor">Exhibitor Slots</Label>
                <Input id="slots_exhibitor" type="number" min="0" value={formData.slots_exhibitor} onChange={(e) => setFormData({...formData, slots_exhibitor: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <Label htmlFor="slots_media">Media Slots</Label>
                <Input id="slots_media" type="number" min="0" value={formData.slots_media} onChange={(e) => setFormData({...formData, slots_media: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <Label htmlFor="slots_other">Other Slots</Label>
                <Input id="slots_other" type="number" min="0" value={formData.slots_other} onChange={(e) => setFormData({...formData, slots_other: parseInt(e.target.value) || 0})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the type "{typeToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}