'use client'; // Layout must be client-side due to providers

import { HasyxProvider } from "hasyx";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <HasyxProvider>
            {children}
          </HasyxProvider>
        </body>
      </html>
    </>
  )
}
