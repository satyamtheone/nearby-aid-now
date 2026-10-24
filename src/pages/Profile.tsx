import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Save,
  User,
  Home,
  MapPin,
  Calendar,
  UserCircle,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Link,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import UserFeedback from "@/components/UserFeedback";
import { WebPushSettings } from "@/components/WebPushSettings";

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileData, setProfileData] = useState({
    full_name: "",
    username: "",
    phone: "",
    age: "",
    gender: "",
    home_address: "",
    current_address: "",
  });
  const [socialLinks, setSocialLinks] = useState({
    instagram: "",
    facebook: "",
    linkedin: "",
    twitter: "",
    other: "",
  });
  const [avatarEmoji, setAvatarEmoji] = useState("");

  const emojis = [
    "😊", // smiling
    "😎", // cool
    "🚀", // rocket
    "💪", // strength
    "🎯", // goal
    "🌟", // star
    "🔥", // fire
    "👨‍💻", // male coder
    "👩‍💻", // female coder
    "🏃‍♂️", // man running
    "🏃‍♀️", // woman running
    "🎨", // art
    "📚", // books
    "🌍", // earth
    "⚡", // lightning
    "😀", // classic smile
    "😄", // cheerful
    "🥳", // party face
    "🤓", // nerdy
    "😌", // relaxed
  ];

  // Fetch existing profile data
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
        return;
      }

      if (data) {
        setProfileData({
          full_name: data.full_name || "",
          username: data.username || "",
          phone: data.phone || "",
          age: data.age?.toString() || "",
          gender: data.gender || "",
          home_address: data.home_address || "",
          current_address: data.current_address || "",
        });
        setSocialLinks({
          instagram: (data.social_links as any)?.instagram || "",
          facebook: (data.social_links as any)?.facebook || "",
          linkedin: (data.social_links as any)?.linkedin || "",
          twitter: (data.social_links as any)?.twitter || "",
          other: (data.social_links as any)?.other || "",
        });
        setAvatarEmoji(data.avatar_emoji || "");
        setAvatarUrl(data.avatar_url || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const uploadProfilePicture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image", description: "Profile pictures must be image files.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image is too large", description: "Choose an image smaller than 10 MB.", variant: "destructive" });
      return;
    }

    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = `${user.id}/profile/${crypto.randomUUID()}.${extension}`;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase.storage.from("community-media").upload(path, file, {
        cacheControl: "3600", contentType: file.type, upsert: false,
      });
      if (error) throw error;
      setAvatarUrl(supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl);
      toast({ title: "Picture uploaded", description: "Save your profile to publish this picture." });
    } catch (error: any) {
      console.error("Profile picture upload failed:", error);
      toast({ title: "Could not upload picture", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updateData = {
        full_name: profileData.full_name.trim() || null,
        username: profileData.username.trim() || null,
        phone: profileData.phone.trim() || null,
        age: profileData.age ? parseInt(profileData.age) : null,
        gender: profileData.gender || null,
        home_address: profileData.home_address.trim() || null,
        current_address: profileData.current_address.trim() || null,
        social_links: socialLinks,
        avatar_emoji: avatarEmoji || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        ...updateData,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });

      navigate("/");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh ">
      {/* Header */}
      <div className="safe-area-top sticky top-0 z-50 border-b-[0.5px] border-blue-200 backdrop-blur-2xl bg-black/10 text-shadow-2xl text-white">
        <div className="max-w-md max-md:max-w-lg md:max-w-3xl mx-auto px-4  py-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Edit Profile</h1>
              <p className="text-sm">Update your personal information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className=" max-w-md max-md:max-w-lg md:max-w-3xl mx-auto px-4 py-4 space-y-6   text-white">
        <WebPushSettings />

        {/* Basic Information */}
        <Card className=" backdrop-blur-xl  bg-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) =>
                    handleInputChange("full_name", e.target.value)
                  }
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileData.username}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                  placeholder="Choose a username"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="Your phone number"
                />
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={profileData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  placeholder="Your age"
                  min="1"
                  max="120"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={profileData.gender}
                onValueChange={(value) => handleInputChange("gender", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Profile Picture */}
        <Card className="border-b-[0.5px] border-blue-200 backdrop-blur-2xl bg-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5" />
              <span>Profile Picture</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <input ref={avatarFileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadProfilePicture} />
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile preview" className="h-20 w-20 rounded-full border-2 border-white/70 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/40 bg-white/10 text-3xl">{avatarEmoji || <User className="h-8 w-8" />}</div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={uploadingAvatar} onClick={() => avatarFileInputRef.current?.click()}>
                {uploadingAvatar ? "Uploading..." : "Choose picture"}
              </Button>
              {avatarUrl && <Button type="button" variant="ghost" onClick={() => setAvatarUrl("")}>Remove</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Avatar Emoji */}
        <Card className="border-b-[0.5px] border-blue-200 backdrop-blur-2xl  bg-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserCircle className="h-5 w-5" />
              <span>Avatar Emoji</span>
            </CardTitle>

            {avatarEmoji && (
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-sm font-medium">Selected:</span>
                <span className="text-2xl rounded-full border-[1px] border-blue-200 sm:px-2 px-1 py-0.5 sm:py-1">
                  {avatarEmoji}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarEmoji("")}
                  className="text-red-500 hover:text-red-700"
                >
                  Clear
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Label>Choose an emoji avatar</Label>
            <div className="flex flex-wrap gap-1  mt-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatarEmoji(emoji)}
                  className={`text-2xl p-2 sm:px-3 rounded-lg border-2 transition-all ${
                    avatarEmoji === emoji
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="border-b-[0.5px] border-blue-200 backdrop-blur-2xl  bg-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link className="h-5 w-5" />
              <span>Social Links</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="instagram"
                  className="flex items-center space-x-2 pb-2"
                >
                  <Instagram className="h-4 w-4" />
                  <span>Instagram</span>
                </Label>
                <Input
                  id="instagram"
                  value={socialLinks.instagram}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({
                      ...prev,
                      instagram: e.target.value,
                    }))
                  }
                  placeholder="Your Instagram username/link"
                />
              </div>
              <div>
                <Label
                  htmlFor="facebook"
                  className="flex items-center space-x-2 pb-2"
                >
                  <Facebook className="h-4 w-4" />
                  <span>Facebook</span>
                </Label>
                <Input
                  id="facebook"
                  value={socialLinks.facebook}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({
                      ...prev,
                      facebook: e.target.value,
                    }))
                  }
                  placeholder="Your Facebook profile/link"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="linkedin"
                  className="flex items-center space-x-2 pb-2"
                >
                  <Linkedin className="h-4 w-4" />
                  <span>LinkedIn</span>
                </Label>
                <Input
                  id="linkedin"
                  value={socialLinks.linkedin}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({
                      ...prev,
                      linkedin: e.target.value,
                    }))
                  }
                  placeholder="Your LinkedIn profile/link"
                />
              </div>
              <div>
                <Label
                  htmlFor="twitter"
                  className="flex items-center space-x-2 pb-2"
                >
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </Label>
                <Input
                  id="twitter"
                  value={socialLinks.twitter}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({
                      ...prev,
                      twitter: e.target.value,
                    }))
                  }
                  placeholder="Your Twitter handle/link"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="other">Other Social Link</Label>
              <Input
                id="other"
                value={socialLinks.other}
                onChange={(e) =>
                  setSocialLinks((prev) => ({ ...prev, other: e.target.value }))
                }
                placeholder="Any other social media link"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card className="border-b-[0.5px] border-blue-200 backdrop-blur-2xl  bg-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Home className="h-5 w-5" />
              <span>Address Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="home_address">Home Address</Label>
              <Textarea
                id="home_address"
                value={profileData.home_address}
                onChange={(e) =>
                  handleInputChange("home_address", e.target.value)
                }
                placeholder="Enter your home address"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="current_address">Current Address</Label>
              <Textarea
                id="current_address"
                value={profileData.current_address}
                onChange={(e) =>
                  handleInputChange("current_address", e.target.value)
                }
                placeholder="Enter your current address (if different from home)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {user && <UserFeedback userId={user.id} />}

        {/* Save Button */}
        <div className="flex justify-end sticky bottom-5">
          <Button
            onClick={handleSave}
            disabled={loading || uploadingAvatar}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? "Saving..." : "Save Profile"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
