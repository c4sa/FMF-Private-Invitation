import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/common/Toast';
import { createSlotRequestsWithUsers } from '@/api/functions';

export default function TestDataSetup() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleCreateSlotRequests = async () => {
        setIsLoading(true);
        try {
            const response = await createSlotRequestsWithUsers();
            if (response.data.success) {
                toast({
                    title: "Success",
                    description: "Slot requests created successfully",
                    variant: "success",
                });
            }
        } catch (error) {
            toast({
                title: "Error", 
                description: "Failed to create slot requests",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <div className="p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Test Data Setup</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button 
                        onClick={handleCreateSlotRequests}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating...' : 'Create Slot Requests'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}