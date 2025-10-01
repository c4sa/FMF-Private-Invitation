import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

const statusColors = {
  pending: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800", 
  declined: "bg-red-100 text-red-800"
};

const typeColors = {
  "VIP": "bg-purple-100 text-purple-800",
  "Speaker": "bg-blue-100 text-blue-800",
  "Delegate": "bg-gray-100 text-gray-800",
  "Official": "bg-indigo-100 text-indigo-800"
};

export default function RecentAttendees({ attendees }) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900">Recent Registrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {attendees.slice(0, 6).map((attendee) => (
          <div key={attendee.id} className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <Avatar>
              <AvatarImage src={attendee.face_photo_url} />
              <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                {attendee.first_name[0]}{attendee.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {attendee.first_name} {attendee.last_name}
              </p>
              <p className="text-sm text-gray-500 truncate">{attendee.email}</p>
              <p className="text-xs text-gray-400">{attendee.organization}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={statusColors[attendee.status]}>
                {attendee.status}
              </Badge>
              <Badge variant="outline" className={typeColors[attendee.attendee_type] || "bg-gray-100 text-gray-800"}>
                {attendee.attendee_type}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {format(new Date(attendee.created_at), "MMM d")}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}