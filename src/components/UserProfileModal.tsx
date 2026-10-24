import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  MapPin,
  Home,
  Calendar,
  UserCircle,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import UserFeedback from "@/components/UserFeedback";
import { Skeleton } from "@/components/ui/skeleton";

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
  avatar_url: string | null;
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
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="user-profile-modal mx-auto max-w-xl rounded-[1.75rem] border-white/25 bg-[#303b91]/92 p-4 text-white shadow-2xl backdrop-blur-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserCircle className="h-5 w-5 text-cyan-100" />
            <span className="text-white">Community profile</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-2">
            <Card className="user-profile-card">
              <CardContent className="flex flex-col items-center gap-3 pt-6">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
            <Card className="user-profile-card">
              <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status and Basic Info */}
            <Card className="user-profile-card">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="mb-3 flex flex-col items-center justify-center gap-3">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={`${profile.full_name || profile.username || userName}'s profile`} className="h-24 w-24 rounded-full border-2 border-white/70 object-cover shadow-xl ring-4 ring-cyan-100/15" />
                    ) : profile?.avatar_emoji ? (
                      <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-white/45 bg-white/10 text-4xl shadow-xl">{profile.avatar_emoji}</div>
                    ) : (
                      <div
                        className={`grid h-20 w-20 place-items-center rounded-full border-2 border-white/45 text-3xl font-semibold text-white shadow-xl ${
                          isOnline ? "bg-green-500" : "bg-gray-400"
                        }`}
                      >{(profile?.full_name || profile?.username || userName || "U").charAt(0).toUpperCase()}</div>
                    )}
                    <h3 className="text-center text-xl font-semibold capitalize text-white">
                      {profile?.full_name ||
                        profile?.username ||
                        userName ||
                        "Anonymous"}
                    </h3>
                  </div>

                  <div className="flex justify-center space-x-2 mb-4">
                    <Badge
                      className={`${isOnline ? "bg-green-600" : "bg-gray-400"}`}
                      variant={isOnline ? "default" : "secondary"}
                    >
                      {isOnline ? "Online" : "Offline"}
                    </Badge>
                    {distance !== undefined && (
                      <Badge variant="outline">
                        {distance < 1
                          ? `${Math.round(distance * 1000)} m`
                          : `${distance.toFixed(1)} km`}{" "}
                        away
                      </Badge>
                    )}
                  </div>

                  {!isOnline && (
                    <p className="text-sm text-white/65">
                      Last seen: {formatLastSeen(profile?.last_seen)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            {profile && (
              <Card className="user-profile-card">
                <CardHeader>
                  <CardTitle className="text-sm text-white">
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.username && (
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-white/60" />
                      <span className="text-sm">@{profile.username}</span>
                    </div>
                  )}

                  {profile.age && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-white/60" />
                      <span className="text-sm">{profile.age} years old</span>
                    </div>
                  )}

                  {profile.gender && (
                    <div className="flex items-center space-x-3">
                      <UserCircle className="h-4 w-4 text-white/60" />
                      <span className="text-sm">
                        {getGenderDisplay(profile.gender)}
                      </span>
                    </div>
                  )}

                  {profile.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-white/60" />
                      <a
                        href={`tel:${profile.phone}`}
                        className="text-sm text-cyan-100 hover:text-white hover:underline"
                      >
                        {profile.phone}
                      </a>
                    </div>
                  )}

                  {profile.location_name && (
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-4 w-4 text-white/60" />
                      <span className="text-sm">{profile.location_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {profile && <UserFeedback userId={profile.id} />}

            {/* Social Links */}
            {profile &&
              profile.social_links &&
              Object.values(profile.social_links).some((link: any) => link) && (
                <Card className="user-profile-card">
                  <CardHeader>
                    <CardTitle className="text-sm text-white">Social Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {profile.social_links.instagram && (
                      <a
                        href={
                          profile.social_links.instagram.startsWith("http")
                            ? profile.social_links.instagram
                            : `https://instagram.com/${profile.social_links.instagram}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 text-sm text-cyan-100 hover:text-white"
                      >
                        <Instagram className="h-4 w-4" />
                        <span>Instagram</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {profile.social_links.facebook && (
                      <a
                        href={
                          profile.social_links.facebook.startsWith("http")
                            ? profile.social_links.facebook
                            : `https://facebook.com/${profile.social_links.facebook}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 text-sm text-cyan-100 hover:text-white"
                      >
                        <Facebook className="h-4 w-4" />
                        <span>Facebook</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {profile.social_links.linkedin && (
                      <a
                        href={
                          profile.social_links.linkedin.startsWith("http")
                            ? profile.social_links.linkedin
                            : `https://linkedin.com/in/${profile.social_links.linkedin}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 text-sm text-cyan-100 hover:text-white"
                      >
                        <Linkedin className="h-4 w-4" />
                        <span>LinkedIn</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {profile.social_links.twitter && (
                      <a
                        href={
                          profile.social_links.twitter.startsWith("http")
                            ? profile.social_links.twitter
                            : `https://twitter.com/${profile.social_links.twitter}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 text-sm text-cyan-100 hover:text-white"
                      >
                        <Twitter className="h-4 w-4" />
                        <span>Twitter</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {profile.social_links.other && (
                      <a
                        href={
                          profile.social_links.other.startsWith("http")
                            ? profile.social_links.other
                            : `https://${profile.social_links.other}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 text-sm text-cyan-100 hover:text-white"
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
              <Card className="user-profile-card">
                <CardHeader>
                    <CardTitle className="text-sm text-white">Address Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.home_address && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Home className="h-4 w-4 text-white/60" />
                        <span className="text-sm font-medium">
                          Home Address
                        </span>
                      </div>
                      <p className="ml-6 text-sm text-white/75">
                        {profile.home_address}
                      </p>
                    </div>
                  )}

                  {profile.current_address && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <MapPin className="h-4 w-4 text-white/60" />
                        <span className="text-sm font-medium">
                          Current Address
                        </span>
                      </div>
                      <p className="ml-6 text-sm text-white/75">
                        {profile.current_address}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {profile &&
              !profile.age &&
              !profile.gender &&
              !profile.phone &&
              !profile.home_address &&
              !profile.current_address && (
                <Card className="user-profile-card">
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-white/65">
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
