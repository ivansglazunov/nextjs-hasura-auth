'use client';

import { Button } from "hasyx/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { KeyRound } from "lucide-react";
import { signIn } from "next-auth/react";
import React, { useState } from "react";

export function CredentialsSignInCard(props: React.HTMLAttributes<HTMLDivElement>) {
  // State for credentials form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null); // State for info/success messages
  const [isCredentialsLoading, setIsCredentialsLoading] = useState(false);

  const handleCredentialsSignIn = async () => {
    setError(null); // Clear previous error
    setInfoMessage(null); // Clear previous info message
    setIsCredentialsLoading(true);
    // No try-catch needed here, signIn promise resolves with error details
    const result = await signIn('credentials', {
      redirect: false, // Prevent page reload
      email,
      password,
    });

    if (result?.error) {
      let actualError = result.error; // Default to the code like 'CredentialsSignin'

      // Try to parse the actual error message from the URL returned by NextAuth
      if (result.url) {
        try {
          const url = new URL(result.url);
          const errorParam = url.searchParams.get('error');
          if (errorParam) {
            actualError = decodeURIComponent(errorParam);
            console.log('Parsed error from URL:', actualError);
          }
        } catch (parseError) {
          console.error('Failed to parse error URL:', parseError);
        }
      }

      // Display the parsed error or the default code
      setError(actualError);
    } else if (result?.ok) {
      // Session should update automatically via useSession (no state change needed here)
      setEmail('');
      setPassword('');
    }
    setIsCredentialsLoading(false);
  };

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Sign In / Sign Up with Email</CardTitle>
        <CardDescription>Enter your email and password to log in or create a new account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email-cred">Email</Label>
          <Input 
            id="email-cred" 
            type="email" 
            placeholder="user@example.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            disabled={isCredentialsLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password-cred">Password</Label>
          <Input 
            id="password-cred" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            disabled={isCredentialsLoading}
          />
        </div>
        {/* Display Info message OR Error message */} 
        {infoMessage && <p className="text-sm text-green-600 dark:text-green-400">{infoMessage}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={handleCredentialsSignIn} disabled={isCredentialsLoading || !email || !password} className="w-full">
          {isCredentialsLoading ? 'Processing...' : <> <KeyRound className="mr-2 h-4 w-4" /> Sign In / Sign Up</>}
        </Button>
      </CardContent>
    </Card>
  );
} 