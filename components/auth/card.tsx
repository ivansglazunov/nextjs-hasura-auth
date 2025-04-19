
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Status } from "../nha/status"

export function AuthCard(props: any) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Auth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <Label>Google</Label>
          <Label>Yandex</Label>
          <Label>GitHub</Label>
          <Label>Coming soon...</Label>
        </div>
      </CardContent>
    </Card>
  )
}
