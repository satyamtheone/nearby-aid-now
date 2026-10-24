import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Lock, User, Phone, Home, Instagram, Facebook } from "lucide-react";
import { Link } from "react-router-dom";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);


  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login Failed",
              description: "Invalid email or password. Please try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Login Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You have successfully signed in.",
          });
        }
      } else {
        const { error } = await signUp(email, password, fullName, {
          phone,
          homeAddress: address,
          socialLinks: { instagram, facebook },
        });
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Sign Up Failed",
              description:
                "An account with this email already exists. Try signing in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign Up Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Account Created!",
            description: "Please check your email to verify your account.",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page page-enter flex min-h-dvh flex-col text-white">
      {/* Header */}
      <header className="safe-area-top glass-header border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-10 w-10 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {isLogin ? "Sign In" : "Create Account"}
              </h1>
              <p className="text-sm ">Join your local community</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <Card className="glass-panel mx-auto w-full max-w-md rounded-3xl px-1 text-white sm:rounded-[2rem] sm:px-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              {isLogin ? "Welcome Back" : "Join Local Help"}
            </CardTitle>
            <p className=" text-shadow-2xl text-white   text-shadow-blue-200">
              {isLogin
                ? "Sign in to connect with your community"
                : "Create an account to get started"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Legal full name (optional)"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      autoComplete="name"
                    />
                  </div>
                  <p className="px-1 text-xs text-white/65">Use your legal name if you choose to add it. Identity documents are not collected or verified here.</p>
                </div>
              )}

              {!isLogin && (
                <>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4" />
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="Mobile number (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} className="pl-10" />
                  </div>
                  <div className="relative">
                    <Home className="absolute left-3 top-3 h-4 w-4" />
                    <Textarea autoComplete="street-address" placeholder="Home or current address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-20 pl-10" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <Instagram className="absolute left-3 top-3 h-4 w-4" />
                      <Input type="text" placeholder="Instagram profile" value={instagram} onChange={(event) => setInstagram(event.target.value)} className="pl-10" aria-label="Instagram profile" />
                    </div>
                    <div className="relative">
                      <Facebook className="absolute left-3 top-3 h-4 w-4" />
                      <Input type="text" placeholder="Facebook profile" value={facebook} onChange={(event) => setFacebook(event.target.value)} className="pl-10" aria-label="Facebook profile" />
                    </div>
                  </div>
                  <p className="-mt-2 px-1 text-xs text-white/65">Profile details are optional now. Complete them later to enable chat messaging. We do not verify government ID documents.</p>
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 " />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                disabled={loading}
              >
                {loading ? (
                  <div className="loading-spinner mr-2 h-5 w-5 rounded-full border-2 border-white border-t-transparent" />
                ) : null}
                {loading
                  ? "Please wait..."
                  : isLogin
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className=" text-white text-sm font-medium"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-white/65">By creating an account you agree to our <Link to="/terms" className="underline text-cyan-100">Terms of Use</Link>. Read the <Link to="/privacy" className="underline text-cyan-100">Privacy Policy</Link>.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
