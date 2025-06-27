
import React, { useState, useEffect } from 'react';
import { MapPin, Users, MessageCircle, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface HelpRequest {
  id: string;
  message: string;
  category: string;
  timestamp: Date;
  distance: number;
  userName: string;
  isUrgent: boolean;
}

const Home = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState("Getting location...");
  const [onlineUsers, setOnlineUsers] = useState(23);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([
    {
      id: '1',
      message: 'Any chemist open near me? Need urgent medicines',
      category: 'Medical',
      timestamp: new Date(Date.now() - 5 * 60000),
      distance: 0.3,
      userName: 'Priya S.',
      isUrgent: true
    },
    {
      id: '2',
      message: 'Looking for a good plumber, my tap is leaking badly',
      category: 'Other',
      timestamp: new Date(Date.now() - 15 * 60000),
      distance: 0.8,
      userName: 'Raj M.',
      isUrgent: false
    },
    {
      id: '3',
      message: 'Anyone know a good restaurant delivering late night?',
      category: 'Food',
      timestamp: new Date(Date.now() - 25 * 60000),
      distance: 1.2,
      userName: 'Anita K.',
      isUrgent: false
    }
  ]);

  useEffect(() => {
    // Simulate getting user location
    setTimeout(() => {
      setLocation("Noida Sector 135");
    }, 2000);
  }, []);

  const formatTime = (timestamp: Date) => {
    const diff = Date.now() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      Medical: 'bg-red-100 text-red-800 border-red-200',
      Food: 'bg-orange-100 text-orange-800 border-orange-200',
      Vehicle: 'bg-blue-100 text-blue-800 border-blue-200',
      Other: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category as keyof typeof colors] || colors.Other;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Your location</p>
                <p className="font-semibold text-gray-900">{location}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1 text-green-600">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">{onlineUsers}</span>
              </div>
              <p className="text-xs text-gray-500">nearby</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Ask for Help Button */}
        <Button 
          onClick={() => navigate('/ask-help')}
          className="w-full h-14 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Ask for Help
        </Button>

        {/* Recent Help Requests */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Requests</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/chat')}
              className="text-blue-600 hover:text-blue-700"
            >
              View All
            </Button>
          </div>

          <div className="space-y-4">
            {helpRequests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getCategoryColor(request.category)}`}
                        >
                          {request.category}
                        </Badge>
                        {request.isUrgent && (
                          <Badge variant="destructive" className="text-xs">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">
                        {request.message}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(request.timestamp)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Navigation className="h-3 w-3" />
                        <span>{request.distance} km away</span>
                      </div>
                      <span>by {request.userName}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate('/chat')}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      Reply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
