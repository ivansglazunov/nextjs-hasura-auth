'use client'; // Layout must be client-side due to providers

import { HasyxProvider } from "hasyx";
import "@/app/globals.css";
import "hasyx/lib/styles.css";
import { Generator } from "hasyx";
import schema from "../public/hasura-schema.json";

const generate = Generator(schema);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
        </head>
        <body>
          <HasyxProvider generate={generate}>
            {children}
          </HasyxProvider>
        </body>
      </html>
    </>
  )
}
