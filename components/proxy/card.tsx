'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "hasyx/components/ui/card";
import { Label } from "hasyx/components/ui/label";
import Debug from 'hasyx/lib/debug';
import { gql, useQuery, useSubscription } from '@apollo/client';
import { useEffect, useState } from "react";
import { Status } from "../nha/status";

const debug = Debug('proxy-card');

export const CHECK_QUERY = gql`
query CheckConnection {
  users(limit: 1) { id }
}
`;

export const CHECK_SUBSCRIPTION = gql`
subscription CheckConnection {
  users(limit: 1) { id }
}
`;

type StatusType = 'connecting' | 'connected' | 'error'

export function ProxyCard(props: any) {
  const [getStatus, setGetStatus] = useState<StatusType>("connecting")
  const [postStatus, setPostStatus] = useState<StatusType>("connecting")
  const [socketStatus, setSocketStatus] = useState<StatusType>("connecting")

  useEffect(() => {
    debug('Checking GET /api/graphql')
    fetch('/api/graphql')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'ok') {
            debug('GET /api/graphql successful')
            setGetStatus("connected")
          } else {
            throw new Error('Invalid GET response format')
          }
        } else {
          throw new Error(`GET request failed with status ${res.status}`)
        }
      })
      .catch((err) => {
        debug('Error checking GET /api/graphql:', err)
        setGetStatus("error")
      })
  }, [])

  const { loading: queryLoading, error: queryError, data: queryData } = useQuery(CHECK_QUERY);

  const { loading: subLoading, error: subError, data: subData } = useSubscription(CHECK_SUBSCRIPTION);

  useEffect(() => {
    if (queryLoading) {
      setPostStatus("connecting")
    } else if (queryError) {
      debug('Error checking POST via useQuery:', queryError)
      setPostStatus("error")
    } else if (queryData?.users) {
      debug('POST check via useQuery successful')
      setPostStatus("connected")
    } else {
      debug('POST check via useQuery returned unexpected data:', queryData)
      setPostStatus("error")
    }
  }, [queryLoading, queryError, queryData])

  useEffect(() => {
    if (subLoading) {
      setSocketStatus("connecting")
    } else if (subError) {
      debug('Error checking SOCKET via useSubscription:', subError)
      setSocketStatus("error")
    } else if (subData?.users) {
      debug('SOCKET check via useSubscription successful (data received)')
      setSocketStatus("connected")
    }
  }, [subLoading, subError, subData])

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>GraphQL Proxy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4 mt-4">
          <Label>GET /api/graphql <Status status={getStatus} /></Label>
          <Label>POST /api/graphql <Status status={postStatus} /></Label>
          <Label>SOCKET /api/graphql <Status status={socketStatus} /></Label>
        </div>
      </CardContent>
    </Card>
  )
}
