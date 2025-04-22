'use client';

import * as React from "react"
import { useEffect, useState } from "react"

import { Button } from "hasyx/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "hasyx/components/ui/card"
import { Input } from "hasyx/components/ui/input"
import { Label } from "hasyx/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "hasyx/components/ui/select"
import { Status } from "../nha/status"
import { useCheckConnection } from "hasyx/lib/hooks/useCheckConnection"
import { useQuery } from 'hasyx'
import Debug from 'hasyx/lib/debug'

type StatusType = 'connecting' | 'connected' | 'error'
const debug = Debug('hasura-card')

export function HasuraCard(props: any) {
  const connectionStatus = useCheckConnection();

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Hasura <Status status={connectionStatus} /></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <Label>Required .env variables</Label>
          <CardDescription>Public</CardDescription>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="NEXT_PUBLIC_HASURA_GRAPHQL_URL">NEXT_PUBLIC_HASURA_GRAPHQL_URL</Label>
            <Input id="NEXT_PUBLIC_HASURA_GRAPHQL_URL" disabled value={process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ?? 'Not Set'} className={process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ? '' : 'border-red-700'}/>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
