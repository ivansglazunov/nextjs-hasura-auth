'use client'; // Layout must be client-side due to providers

import { HasyxProvider } from "hasyx";
import "@/app/globals.css";
import { Generator } from "hasyx";
import schema from "../public/hasura-schema.json";

const generate = Generator(schema);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <HasyxProvider generate={generate}>
            {children}
          </HasyxProvider>
        </body>
      </html>
    </>
  )
}
