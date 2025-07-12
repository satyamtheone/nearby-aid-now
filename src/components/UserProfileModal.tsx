import React, { useState, useEffect } from "react";
import { X, User, Phone, MapPin, Home, Calendar, UserCircle, Instagram, Facebook, Linkedin, Twitter, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  home_address: string | null;
  current_address: string | null;
  location_name: string | null;
  status: string | null;
  last_seen: string | null;
  social_links: any;
  avatar_emoji: string | null;
}

interface UserProfileModalProps {
  userId: string;
  userName: string;
  isOnline: boolean;
  distance?: number;
  children: React.ReactNode;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  userName,
  isOnline,
  distance,
  children,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchProfile = async () => {
    if (!userId || !open) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open, userId]);

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "Unknown";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getGenderDisplay = (gender: string | null) => {
    if (!gender) return "Not specified";
    return gender.charAt(0).toUpperCase() + gender.slice(1).replace("_", " ");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserCircle className="h-5 w-5" />
            <span>User Profile</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status and Basic Info */}
            <Card>
              <CardContent className="pt-6">
                 <div className="text-center">
                   <div className="flex items-center justify-center space-x-3 mb-3">
                     {profile?.avatar_emoji ? (
                       <span className="text-2xl">{profile.avatar_emoji}</span>
                     ) : (
                       <div className={`w-4 h-4 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"}`}></div>
                     )}
                     <h3 className="text-lg font-semibold">
                       {profile?.full_name || profile?.username || userName || "Anonymous"}
                     </h3>
                   </div>
                  
                  <div className="flex justify-center space-x-2 mb-4">
                    <Badge variant={isOnline ? "default" : "secondary"}>
                      {isOnline ? "Online" : "Offline"}
                    </Badge>
                    {distance !== undefined && (
                      <Badge variant="outline">
                        {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
                      </Badge>
                    )}
                  </div>

                  {!isOnline && (
                    <p className="text-sm text-gray-500">
                      Last seen: {formatLastSeen(profile?.last_seen)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            {profile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.username && (
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">@{profile.username}</span>
                    </div>
                  )}
                  
                  {profile.age && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{profile.age} years old</span>
                    </div>
                  )}
                  
                  {profile.gender && (
                    <div className="flex items-center space-x-3">
                      <UserCircle className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{getGenderDisplay(profile.gender)}</span>
                    </div>
                  )}

                  {profile.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{profile.phone}</span>
                    </div>
                  )}

                  {profile.location_name && (
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{profile.location_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Social Links */}
            {profile && profile.social_links && Object.values(profile.social_links).some((link: any) => link) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Social Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.social_links.instagram && (
                    <a
                      href={profile.social_links.instagram.startsWith('http') ? profile.social_links.instagram : `https://instagram.com/${profile.social_links.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Instagram className="h-4 w-4" />
                      <span>Instagram</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {profile.social_links.facebook && (
                    <a
                      href={profile.social_links.facebook.startsWith('http') ? profile.social_links.facebook : `https://facebook.com/${profile.social_links.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Facebook className="h-4 w-4" />
                      <span>Facebook</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {profile.social_links.linkedin && (
                    <a
                      href={profile.social_links.linkedin.startsWith('http') ? profile.social_links.linkedin : `https://linkedin.com/in/${profile.social_links.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Linkedin className="h-4 w-4" />
                      <span>LinkedIn</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {profile.social_links.twitter && (
                    <a
                      href={profile.social_links.twitter.startsWith('http') ? profile.social_links.twitter : `https://twitter.com/${profile.social_links.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Twitter className="h-4 w-4" />
                      <span>Twitter</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {profile.social_links.other && (
                    <a
                      href={profile.social_links.other.startsWith('http') ? profile.social_links.other : `https://${profile.social_links.other}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Other Link</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Address Information */}
            {profile && (profile.home_address || profile.current_address) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Address Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.home_address && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Home className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Home Address</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{profile.home_address}</p>
                    </div>
                  )}
                  
                  {profile.current_address && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Current Address</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{profile.current_address}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {profile && !profile.age && !profile.gender && !profile.phone && !profile.home_address && !profile.current_address && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-gray-500">
                    This user hasn't filled out their profile yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;