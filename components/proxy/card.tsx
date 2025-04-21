'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { CHECK_CONNECTION_QUERY, CHECK_CONNECTION_SUBSCRIPTION, createApolloClient } from "@/lib/apollo"
import { useQuery, useSubscription, ApolloProvider } from '@apollo/client'
import Debug from '@/lib/debug'

const debug = Debug('proxy-card')

type StatusType = 'connecting' | 'connected' | 'error'

export function ProxyCard(props: any) {
  const [getStatus, setGetStatus] = useState<StatusType>("connecting")
  const [postStatus, setPostStatus] = useState<StatusType>("connecting")
  const [socketStatus, setSocketStatus] = useState<StatusType>("connecting")

  const proxyClient = useMemo(() => {
    debug('Creating Apollo Client for Proxy Card (/api/graphql)')
    try {
      return createApolloClient({
        url: '/api/graphql',
        ws: true,
        token: undefined,
        secret: undefined
      })
    } catch (error) {
      debug('Error creating proxy Apollo client:', error)
      return null
    }
  }, [])

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

  const ProxyStatusChecker = () => {
    if (!proxyClient) {
      useEffect(() => {
        debug('Proxy Apollo Client is null, setting POST/SOCKET to error')
        setPostStatus("error")
        setSocketStatus("error")
      }, [])
      return null
    }

    const { loading: queryLoading, error: queryError, data: queryData } = useQuery(
      CHECK_CONNECTION_QUERY,
      { client: proxyClient, fetchPolicy: 'network-only' }
    )

    const { loading: subLoading, error: subError, data: subData } = useSubscription(
      CHECK_CONNECTION_SUBSCRIPTION,
      { client: proxyClient }
    )

    useEffect(() => {
      if (queryLoading) {
        setPostStatus("connecting")
      } else if (queryError) {
        debug('Error checking POST via useQuery:', queryError)
        setPostStatus("error")
      } else if (queryData?.__schema?.queryType?.name) {
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
      } else if (subData?.__schema?.queryType?.name) {
        debug('SOCKET check via useSubscription successful (data received)')
        setSocketStatus("connected")
      }
    }, [subLoading, subError, subData])
    
    return null
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>GraphQL Proxy</CardTitle>
      </CardHeader>
      <CardContent>
        {proxyClient ? (
          <ApolloProvider client={proxyClient}>
            <ProxyStatusChecker />
          </ApolloProvider>
        ) : (
          <p className="text-red-500 text-sm">Failed to initialize proxy client.</p>
        )}
        <div className="grid w-full items-center gap-4 mt-4">
          <Label>GET /api/graphql <Status status={getStatus} /></Label>
          <Label>POST /api/graphql <Status status={postStatus} /></Label>
          <Label>SOCKET /api/graphql <Status status={socketStatus} /></Label>
        </div>
      </CardContent>
    </Card>
  )
}
