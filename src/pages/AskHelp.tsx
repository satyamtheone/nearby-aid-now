
import React, { useState } from 'react';
import { ArrowLeft, Send, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useHelpRequests } from '@/hooks/useHelpRequests';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

const AskHelp = () => {
  const navigate = useNavigate();
  const { createHelpRequest } = useHelpRequests();
  const { userLocation } = useAuth();
  const [category, setCategory] = useState<Database['public']['Enums']['help_category'] | ''>('');
  const [message, setMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: 'Medical' as const, label: 'Medical', icon: '🏥' },
    { value: 'Food' as const, label: 'Food & Groceries', icon: '🍽️' },
    { value: 'Vehicle' as const, label: 'Vehicle & Transport', icon: '🚗' },
    { value: 'Other' as const, label: 'Other', icon: '🤝' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a category and enter your message.",
        variant: "destructive"
      });
      return;
    }

    if (!userLocation) {
      toast({
        title: "Location Required",
        description: "Please allow location access to send help requests.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await createHelpRequest({
        category,
        message: message.trim(),
        is_urgent: isUrgent,
        location_name: userLocation.name,
      });

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Help Request Sent!",
          description: "Your request has been shared with nearby users.",
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send help request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Ask for Help</h1>
              <p className="text-sm text-gray-500 flex items-center">
                <MapPin className="h-3 w-3 mr-1" />
                {userLocation ? userLocation.name : 'Getting location...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl text-gray-900">
              What do you need help with?
            </CardTitle>
            <p className="text-center text-sm text-gray-600">
              Your request will be shared with nearby community members
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <Select value={category} onValueChange={(value: Database['public']['Enums']['help_category']) => setCategory(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center space-x-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Message *
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what help you need..."
                  className="min-h-[120px] resize-none"
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {message.length}/200 characters
                </p>
              </div>

              {/* Urgent Toggle */}
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="font-medium text-red-800">Mark as Urgent</p>
                  <p className="text-sm text-red-600">
                    Urgent requests get higher priority
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isUrgent ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setIsUrgent(!isUrgent)}
                >
                  {isUrgent ? "Urgent" : "Normal"}
                </Button>
              </div>

              {/* Preview */}
              {category && message && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <div className="flex items-start space-x-2 mb-2">
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                    >
                      {category}
                    </Badge>
                    {isUrgent && (
                      <Badge variant="destructive" className="text-xs">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{message}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={isSubmitting || !category || !message.trim() || !userLocation}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                ) : (
                  <Send className="mr-2 h-5 w-5" />
                )}
                {isSubmitting ? 'Sending Help Request...' : 'Send Help Request'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">Location-Based Help</p>
                <p className="text-xs text-blue-700 mt-1">
                  Your request will only be visible to users within 2km of your location
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AskHelp;
