'use client';

import { Button } from "hasyx/components/ui/button"
import { Check, Loader2, X } from "lucide-react"

type StatusProps = {
  status?: 'connecting' | 'connected' | 'error' | 'idle';
  label?: string;
  error?: any;
}

export function Status({ status = 'connecting', label, error }: StatusProps) {
  // Display custom label if provided, otherwise use default text
  const connectingText = label || 'Connecting';
  const connectedText = label || 'Connected';
  const errorText = label || 'Error';
  const idleText = label || 'Idle';
  return (<>

    {status === 'connecting' && <Button variant="ghost" className="p-0"><Loader2 className="animate-spin mr-1" /> {connectingText}</Button>}
    {status === 'connected' && <Button variant="ghost" className="p-0"><Check className="mr-1" /> {connectedText}</Button>}
    {status === 'error' && <Button variant="ghost" className="p-0"><X className="mr-1" /> {errorText}</Button>}
    {status === 'idle' && <Button variant="ghost" className="p-0"><X className="mr-1" /> {idleText}</Button>}
  </>)
}
