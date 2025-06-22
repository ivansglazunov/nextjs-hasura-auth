'use client';

import { useState, useEffect } from 'react';
import { Button } from "hasyx/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { KeyRound } from "lucide-react";
import { API_URL } from 'hasyx/lib/url';

export default function PassiveSigninPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passiveId, setPassiveId] = useState<string | null>(null);

  useEffect(() => {
    // Get passive ID from URL params
    const url = new URL(window.location.href);
    const passive = url.searchParams.get('passive');
    const redirect = url.searchParams.get('redirect');
    
    if (passive) {
      setPassiveId(passive);
      setMessage(`Passive authentication mode. ID: ${passive}`);
    } else {
      setError('No passive parameter found in URL');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passiveId) {
      setError('Missing passive ID');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use NextAuth signIn with passive parameter in callbackUrl
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: `/?passive=${passiveId}`,
      });

      if (result?.error) {
        setError('Invalid credentials');
      } else if (result?.ok) {
        // Authentication successful, redirect to complete the flow
        window.location.href = result.url || `/?passive=${passiveId}`;
      }
      
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Authentication failed');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Passive Authentication</CardTitle>
          <CardDescription>
            Enter your credentials for passive authentication mode
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
              {message}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="user@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={loading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                disabled={loading}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={loading || !email || !password || !passiveId} 
              className="w-full"
            >
              {loading ? 'Processing...' : (
                <> 
                  <KeyRound className="mr-2 h-4 w-4" /> 
                  Sign In (Passive)
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 