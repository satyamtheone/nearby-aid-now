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
import { getProfileRequirementStatus } from "@/utils/profileCompletion";

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
  const profileStatus = getProfileRequirementStatus({ ...profileData, social_links: socialLinks });

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
    <div className="app-page page-enter min-h-dvh text-white">
      {/* Header */}
      <header className="safe-area-top glass-header sticky top-0 z-40 border-b text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-semibold sm:text-lg">Edit profile</h1>
              <p className="text-xs text-white/70 sm:text-sm">Your details and preferences</p>
            </div>
        </div>
      </header>

      {/* Profile Form */}
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-32 pt-5 text-white sm:space-y-6 sm:px-6 sm:pt-8">
        <WebPushSettings />

        <Card className="glass-panel rounded-3xl border-white/25 text-white">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Profile completeness</p>
                <p className="mt-1 text-xs text-white/70">Complete these details to build trust and enable chat messaging. You can save and finish later.</p>
              </div>
              <span className="text-2xl font-bold tabular-nums text-cyan-100">{profileStatus.percentage}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={profileStatus.percentage}
              className="h-2.5 overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-teal-300 transition-[width] duration-500" style={{ width: `${profileStatus.percentage}%` }} />
            </div>
            <ul className="grid gap-2 text-xs sm:grid-cols-2 sm:text-sm">
              {profileStatus.items.map((item) => (
                <li key={item.key} className={`flex items-center gap-2 ${item.complete ? "text-emerald-100" : "text-white/65"}`}>
                  <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${item.complete ? "border-emerald-200/50 bg-emerald-300/20" : "border-white/30 bg-white/5"}`}>{item.complete ? "✓" : "•"}</span>
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="border-t border-white/15 pt-3 text-xs leading-relaxed text-white/65">
              Use your legal name as shown on official ID. We do not collect or verify government ID documents; profile details are self-reported.
            </p>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card className="glass-panel rounded-3xl text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Legal full name <span className="text-rose-200">*</span></Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) =>
                    handleInputChange("full_name", e.target.value)
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
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
                <Label htmlFor="phone">Mobile number <span className="text-rose-200">*</span></Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="Your phone number"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
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
        <Card className="glass-panel rounded-3xl text-white">
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
        <Card className="glass-panel rounded-3xl text-white">
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
        <Card className="glass-panel rounded-3xl text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link className="h-5 w-5" />
              <span>Social Links</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-white/65">Add at least one profile: Instagram or Facebook, to enable chat messaging.</p>
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
        <Card className="glass-panel rounded-3xl text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Home className="h-5 w-5" />
              <span>Address Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-white/65">Enter at least one address (home or current).</p>
            <div>
              <Label htmlFor="home_address">Home address <span className="text-rose-200">(or current address is required)</span></Label>
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
        <div className="sticky bottom-24 flex justify-end md:bottom-5">
          <Button
            onClick={handleSave}
            disabled={loading || uploadingAvatar}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? "Saving..." : "Save Profile"}</span>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
