
import React, { useState, useEffect } from 'react';
import { MapPin, Users, MessageCircle, Clock, Navigation, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHelpRequests } from '@/hooks/useHelpRequests';

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut, userLocation, nearbyUsersCount } = useAuth();
  const { helpRequests, loading } = useHelpRequests();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleRequestReply = (requestId: string) => {
    navigate(`/chat/${requestId}`);
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
                <p className="font-semibold text-gray-900">
                  {userLocation ? userLocation.name : 'Getting location...'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="flex items-center space-x-1 text-green-600">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">{nearbyUsersCount}</span>
                </div>
                <p className="text-xs text-gray-500">nearby</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSignOut}
                className="p-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {user && (
            <p className="text-xs text-gray-500 mt-1">
              Welcome, {user.email}
            </p>
          )}
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

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {helpRequests.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">No help requests yet. Be the first to ask for help!</p>
                  </CardContent>
                </Card>
              ) : (
                helpRequests.map((request) => (
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
                            {request.is_urgent && (
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
                            <span>{formatTime(request.created_at)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Navigation className="h-3 w-3" />
                            <span>0.5 km away</span>
                          </div>
                          <span>by {request.profiles?.username || 'Anonymous'}</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRequestReply(request.id)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          Reply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
