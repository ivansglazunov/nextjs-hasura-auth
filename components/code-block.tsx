'use client'

import { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Check, Clipboard } from 'lucide-react';

interface CodeBlockProps {
  value: string;
  language?: string; // Optional language for syntax highlighting (if we add it later)
}

export function CodeBlock({ value, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return (
    <div className="relative rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-6 w-6" 
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Clipboard className="h-4 w-4" />
        )}
      </Button>
      <pre><code>{value}</code></pre>
    </div>
  );
} 