
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Status } from "../nha/status"

export function ApolloCard(props: any) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Apollo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <Label>Apollo Client <Status status="connecting" /></Label>
          <Label>HttpLink <Status status="connecting" /></Label>
          <Label>WebSocketLink <Status status="connecting" /></Label>
        </div>
      </CardContent>
    </Card>
  )
}
