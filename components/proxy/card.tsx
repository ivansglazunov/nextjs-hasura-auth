import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Status } from "../nha/status"

export function ProxyCard(props: any) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Proxy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <Label>GET /api/graphql <Status status="connecting" /></Label>
          <Label>POST /api/graphql <Status status="connecting" /></Label>
          <Label>SOCKET /api/graphql <Status status="connecting" /></Label>
        </div>
      </CardContent>
    </Card>
  )
}
