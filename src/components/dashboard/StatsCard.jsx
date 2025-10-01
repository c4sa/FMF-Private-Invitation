import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, color = "blue", subtitle }) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600", 
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600"
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}