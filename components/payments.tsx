"use client";

import { useEffect, useState } from "react";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "hasyx/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "hasyx/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "hasyx/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "hasyx/components/ui/select";
import { Button } from "hasyx/components/ui/button";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { Textarea } from "hasyx/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "hasyx/components/ui/table";
import { Badge } from "hasyx/components/ui/badge";
import { SidebarData } from "hasyx/components/sidebar";
import { toast, Toaster } from "sonner";
import { useHasyx, useSession, useSubscription, useQuery } from "hasyx";
import { format } from "date-fns";
import { PlusCircle, Trash2, CreditCard, Calendar, DollarSign } from "lucide-react";

interface PaymentsProps {
  sidebarData: SidebarData;
}

interface PaymentProvider {
  id: string;
  name: string;
  type: string;
  is_test_mode: boolean;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  user_id: string;
  provider_id: string;
  external_id: string;
  type: string;
  details: any;
  is_default: boolean;
  is_recurrent_ready: boolean;
  recurrent_details: any;
  expires_at: number | null;
  status: string;
  created_at: string;
  provider: {
    name: string;
    type: string;
    is_test_mode: boolean;
  };
}

interface PaymentPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  interval_count: number;
  trial_period_days: number;
  active: boolean;
  features: any;
  user_id: string | null;
  created_at: string;
}

interface PaymentOperation {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  method_id: string | null;
  provider_id: string;
  created_at: string;
  subscription_id: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  method_id: string;
  provider_id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  computed_next_billing_date: number | null;
  computed_last_billing_date: number | null;
  computed_missed_cycles: number;
  billing_retry_count: number;
  created_at: string;
  plan: {
    name: string;
    price: number;
    currency: string;
    interval: string;
    interval_count: number;
  };
  method: {
    type: string;
    details: any;
  };
  provider: {
    name: string;
    type: string;
  };
}

export default function Payments({ sidebarData }: PaymentsProps) {
  const [tabValue, setTabValue] = useState("providers");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  
  // Dialog states
  const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false);
  const [isAddMethodDialogOpen, setIsAddMethodDialogOpen] = useState(false);
  const [isAddPlanDialogOpen, setIsAddPlanDialogOpen] = useState(false);
  const [isCreateSubscriptionDialogOpen, setIsCreateSubscriptionDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  
  // Form states
  const [addProviderType, setAddProviderType] = useState<"tbank_test" | "tbank_prod" | null>(null);
  const [selectedProviderForPayment, setSelectedProviderForPayment] = useState<PaymentProvider | null>(null);
  const [selectedPlanForSubscription, setSelectedPlanForSubscription] = useState<PaymentPlan | null>(null);
  
  const [newProvider, setNewProvider] = useState({
    name: "",
    terminal_key: "",
    secret_key: "",
  });
  
  const [newMethod, setNewMethod] = useState({
    provider_id: "",
    customer_key: "",
  });
  
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: "",
    currency: "RUB",
    interval: "month",
    interval_count: "1",
    trial_period_days: "0",
    features: "",
  });
  
  const [newSubscription, setNewSubscription] = useState({
    plan_id: "",
    method_id: "",
  });
  
  const [newPayment, setNewPayment] = useState({
    amount: "",
    currency: "RUB",
    description: "",
  });

  const [currentPaymentOperation, setCurrentPaymentOperation] = useState<string | null>(null);

  const hasyx = useHasyx();
  const { data: session } = useSession();
  
  // Subscriptions for data
  const { data: providers, loading: providersLoading } = useQuery({
    table: "payments_providers",
    returning: ["id", "name", "type", "is_test_mode", "created_at"],
    order_by: { created_at: "desc" },
  });

  console.log('providers', providers);
  console.log('providersLoading', providersLoading);

  const { data: paymentMethods, loading: methodsLoading } = useQuery({
    table: "payments_methods",
    where: { user_id: { _eq: session?.user?.id || "never-match" } },
    returning: [
      "id",
      // "user_id", "provider_id", "external_id", "type", "details", 
      // "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", 
      // "status", "created_at",
      // {
      //   provider: ["name", "type", "is_test_mode"]
      // }
    ],
    order_by: { created_at: "desc" },
  });

  const { data: plans, loading: plansLoading } = useQuery({
    table: "payments_plans",
    where: { active: { _eq: true } },
    returning: [
      "id", "name", "description", "price", "currency", "interval", 
      "interval_count", "trial_period_days", "active", "features", 
      "user_id", "created_at"
    ],
    order_by: { created_at: "desc" },
  });

  const { data: subscriptions, loading: subscriptionsLoading } = useQuery({
    table: "payments_subscriptions",
    where: { user_id: { _eq: session?.user?.id || "never-match" } },
    returning: [
      "id", "user_id", "method_id", "provider_id", "plan_id", "status",
      "current_period_start", "current_period_end", "computed_next_billing_date",
      "computed_last_billing_date", "computed_missed_cycles", "billing_retry_count", "created_at",
      {
        plan: ["name", "price", "currency", "interval", "interval_count"]
      },
      {
        method: ["type", "details"]
      },
      {
        provider: ["name", "type"]
      }
    ],
    order_by: { created_at: "desc" },
  });

  const { data: operations, loading: operationsLoading } = useQuery({
    table: "payments_operations",
    where: { user_id: { _eq: session?.user?.id || "never-match" } },
    returning: [
      "id", "user_id", "amount", "currency", "status", "description", 
      "method_id", "provider_id", "created_at", "subscription_id"
    ],
    order_by: { created_at: "desc" },
    limit: 50,
  });

  // Track current payment operation
  const { data: paymentOperationStatus } = useQuery({
    table: "payments_operations",
    where: currentPaymentOperation ? { id: { _eq: currentPaymentOperation } } : { id: { _eq: "never-match" } },
    returning: ["id", "status", "external_operation_id", "error_message", "provider_response_details", "paid_at", "updated_at"],
  });

  // Effect to show payment status updates
  useEffect(() => {
    if (paymentOperationStatus && paymentOperationStatus.length > 0) {
      const operation = paymentOperationStatus[0];
      
      switch (operation.status) {
        case 'succeeded':
          toast.success("Payment completed successfully!");
          setCurrentPaymentOperation(null);
          break;
        case 'failed':
          toast.error(`Payment failed: ${operation.error_message || 'Unknown error'}`);
          setCurrentPaymentOperation(null);
          break;
        case 'canceled':
          toast.warning("Payment was canceled");
          setCurrentPaymentOperation(null);
          break;
        case 'pending_user_action':
          toast.info("Please complete payment in the opened window");
          break;
        case 'pending_confirmation':
          toast.info("Payment is being processed...");
          break;
      }
    }
  }, [paymentOperationStatus]);

  // Handlers
  const handleAddProviderClick = (type: "tbank_test" | "tbank_prod") => {
    setAddProviderType(type);
    setNewProvider({
      name: type === "tbank_test" ? "TBank Test" : "TBank Production",
      terminal_key: "",
      secret_key: "",
    });
    setIsAddProviderDialogOpen(true);
  };

  const handleProviderSubmit = async () => {
    if (!newProvider.name || !newProvider.terminal_key || !newProvider.secret_key) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const isTestMode = addProviderType === "tbank_test";
      await hasyx.insert({
        table: "payments_providers",
        object: {
          name: newProvider.name,
          type: "tbank",
          is_test_mode: isTestMode,
          config: {
            terminal_key: newProvider.terminal_key,
            secret_key: newProvider.secret_key,
            is_test_mode: isTestMode,
          },
        },
      });

      toast.success("Provider added successfully!");
      setIsAddProviderDialogOpen(false);
      setNewProvider({ name: "", terminal_key: "", secret_key: "" });
    } catch (error: any) {
      toast.error(`Failed to add provider: ${error.message}`);
    }
  };

  const handleAddMethodSubmit = async () => {
    if (!newMethod.provider_id || !newMethod.customer_key) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch('/api/payments/tbank/add-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: newMethod.provider_id,
          customer_key: newMethod.customer_key,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.redirect_url) {
        window.open(result.redirect_url, '_blank');
        toast.info("Please complete card verification in the opened window");
      } else {
        throw new Error(result.error || 'Failed to initiate card addition');
      }

      setIsAddMethodDialogOpen(false);
      setNewMethod({ provider_id: "", customer_key: "" });
    } catch (error: any) {
      toast.error(`Failed to add payment method: ${error.message}`);
    }
  };

  const handleRemoveMethod = async (methodId: string) => {
    try {
      await hasyx.delete({
        table: "payments_methods",
        pk_columns: { id: methodId },
      });
      toast.success("Payment method removed successfully!");
    } catch (error: any) {
      if (error.message.includes('violates foreign key constraint')) {
        toast.error("Cannot remove payment method: it's being used by an active subscription");
      } else {
        toast.error(`Failed to remove payment method: ${error.message}`);
      }
    }
  };

  const handleAddPlanSubmit = async () => {
    if (!newPlan.name || !newPlan.price || !newPlan.interval_count) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await hasyx.insert({
        table: "payments_plans",
        object: {
          name: newPlan.name,
          description: newPlan.description,
          price: parseFloat(newPlan.price),
          currency: newPlan.currency,
          interval: newPlan.interval,
          interval_count: parseInt(newPlan.interval_count),
          trial_period_days: parseInt(newPlan.trial_period_days),
          features: newPlan.features ? JSON.parse(newPlan.features) : null,
          user_id: session?.user?.id,
        },
      });

      toast.success("Plan created successfully!");
      setIsAddPlanDialogOpen(false);
      setNewPlan({
        name: "",
        description: "",
        price: "",
        currency: "RUB",
        interval: "month",
        interval_count: "1",
        trial_period_days: "0",
        features: "",
      });
    } catch (error: any) {
      toast.error(`Failed to create plan: ${error.message}`);
    }
  };

  const handleRemovePlan = async (planId: string) => {
    try {
      await hasyx.delete({
        table: "payments_plans",
        pk_columns: { id: planId },
      });
      toast.success("Plan removed successfully!");
    } catch (error: any) {
      toast.error(`Failed to remove plan: ${error.message}`);
    }
  };

  const handleCreateSubscriptionSubmit = async () => {
    if (!newSubscription.plan_id || !newSubscription.method_id) {
      toast.error("Please select both plan and payment method");
      return;
    }

    try {
      const response = await fetch('/api/payments/tbank/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: newSubscription.plan_id,
          method_id: newSubscription.method_id,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.redirect_url) {
          window.open(result.redirect_url, '_blank');
          toast.info("Please complete initial payment in the opened window");
        } else {
          toast.success("Subscription created successfully!");
        }
      } else {
        throw new Error(result.error || 'Failed to create subscription');
      }

      setIsCreateSubscriptionDialogOpen(false);
      setNewSubscription({ plan_id: "", method_id: "" });
    } catch (error: any) {
      toast.error(`Failed to create subscription: ${error.message}`);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!newPayment.amount || !selectedProviderForPayment) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch('/api/payments/tbank/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProviderForPayment.id,
          amount: parseFloat(newPayment.amount),
          currency: newPayment.currency,
          description: newPayment.description,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.redirect_url) {
        setCurrentPaymentOperation(result.operation_id);
        window.open(result.redirect_url, '_blank');
        toast.info("Please complete payment in the opened window");
      } else {
        throw new Error(result.error || 'Failed to initiate payment');
      }

      setIsPaymentDialogOpen(false);
      setNewPayment({ amount: "", currency: "RUB", description: "" });
    } catch (error: any) {
      toast.error(`Failed to create payment: ${error.message}`);
    }
  };

  const formatInterval = (interval: string, count: number) => {
    const unit = count === 1 ? interval : `${interval}s`;
    return count === 1 ? unit : `${count} ${unit}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'succeeded': return 'default';
      case 'pending_user_action': return 'secondary';
      case 'pending_confirmation': return 'secondary';
      case 'failed': return 'destructive';
      case 'canceled': return 'outline';
      case 'past_due': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <SidebarLayout sidebarData={sidebarData}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Payments</h1>
        </div>
        
        <Tabs value={tabValue} onValueChange={setTabValue} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start px-4 py-2 border-b">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>
          
          {/* Providers Tab */}
          <TabsContent value="providers" className="p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Payment Providers</h2>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => handleAddProviderClick("tbank_test")}>
                  Add TBank Test
                </Button>
                <Button onClick={() => handleAddProviderClick("tbank_prod")}>
                  Add TBank Production
                </Button>
              </div>
            </div>
            
            {providersLoading ? (
              <div>Loading providers...</div>
            ) : providers && providers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider: PaymentProvider) => (
                  <Card key={provider.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {provider.name}
                        <Badge variant={provider.is_test_mode ? "secondary" : "default"}>
                          {provider.is_test_mode ? "Test" : "Production"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {provider.type} • Created {format(new Date(provider.created_at), "PPP")}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No payment providers configured</p>
              </div>
            )}
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="methods" className="p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Payment Methods</h2>
              <Button onClick={() => setIsAddMethodDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
            
            {methodsLoading ? (
              <div>Loading payment methods...</div>
            ) : paymentMethods && paymentMethods.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paymentMethods.map((method: PaymentMethod) => (
                  <Card key={method.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CreditCard className="h-4 w-4 mr-2" />
                          {method.type}
                        </div>
                        <div className="flex space-x-1">
                          {method.is_default && <Badge variant="default">Default</Badge>}
                          {method.is_recurrent_ready && <Badge variant="secondary">Recurrent</Badge>}
                        </div>
                      </CardTitle>
                      <CardDescription>
                        {method.provider.name} • {method.provider.is_test_mode ? "Test" : "Production"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>Status: <Badge variant={getStatusBadgeVariant(method.status)}>{method.status}</Badge></div>
                        {method.details?.pan && <div>Card: **** {method.details.pan}</div>}
                        {method.expires_at && (
                          <div>Expires: {format(new Date(method.expires_at), "MM/yy")}</div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleRemoveMethod(method.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No payment methods added</p>
              </div>
            )}
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Subscription Plans</h2>
              <Button onClick={() => setIsAddPlanDialogOpen(true)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </div>
            
            {plansLoading ? (
              <div>Loading plans...</div>
            ) : plans && plans.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan: PaymentPlan) => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {plan.name}
                        <Badge variant="default">
                          {plan.price} {plan.currency}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Every {formatInterval(plan.interval, plan.interval_count)}
                        {plan.trial_period_days > 0 && ` • ${plan.trial_period_days} day trial`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      {plan.features && (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Features:</p>
                          <pre className="text-xs text-muted-foreground mt-1">
                            {JSON.stringify(plan.features, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedPlanForSubscription(plan);
                          setNewSubscription({ ...newSubscription, plan_id: plan.id });
                          setIsCreateSubscriptionDialogOpen(true);
                        }}
                      >
                        Subscribe
                      </Button>
                      {plan.user_id === session?.user?.id && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleRemovePlan(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No subscription plans available</p>
              </div>
            )}
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">My Subscriptions</h2>
            </div>
            
            {subscriptionsLoading ? (
              <div>Loading subscriptions...</div>
            ) : subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-4">
                {subscriptions.map((subscription: Subscription) => (
                  <Card key={subscription.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {subscription.plan.name}
                        </div>
                        <Badge variant={getStatusBadgeVariant(subscription.status)}>
                          {subscription.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {subscription.provider.name} • {subscription.method.type}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Amount</p>
                          <p>{subscription.plan.price} {subscription.plan.currency}</p>
                        </div>
                        <div>
                          <p className="font-medium">Billing</p>
                          <p>Every {formatInterval(subscription.plan.interval, subscription.plan.interval_count)}</p>
                        </div>
                        {subscription.computed_next_billing_date && (
                          <div>
                            <p className="font-medium">Next Billing</p>
                            <p>{format(new Date(subscription.computed_next_billing_date), "PPP")}</p>
                          </div>
                        )}
                        {subscription.computed_last_billing_date && (
                          <div>
                            <p className="font-medium">Last Billing</p>
                            <p>{format(new Date(subscription.computed_last_billing_date), "PPP")}</p>
                          </div>
                        )}
                        {subscription.computed_missed_cycles > 0 && (
                          <div>
                            <p className="font-medium">Missed Cycles</p>
                            <p className="text-orange-600">{subscription.computed_missed_cycles}</p>
                          </div>
                        )}
                        {subscription.billing_retry_count > 0 && (
                          <div>
                            <p className="font-medium">Retry Count</p>
                            <p className="text-red-600">{subscription.billing_retry_count}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No active subscriptions</p>
              </div>
            )}
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Payment Operations</h2>
              <Button onClick={() => setIsPaymentDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Payment
              </Button>
            </div>
            
            {operationsLoading ? (
              <div>Loading operations...</div>
            ) : operations && operations.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((operation: PaymentOperation) => (
                      <TableRow key={operation.id}>
                        <TableCell className="font-mono text-xs">
                          {operation.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {operation.amount} {operation.currency}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(operation.status)}>
                            {operation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{operation.description || "-"}</TableCell>
                        <TableCell>
                          {operation.subscription_id ? "Subscription" : "One-time"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(operation.created_at), "PPP")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No payment operations found</p>
              </div>
            )}

            {/* Payment tracking diagnostic */}
            {currentPaymentOperation && paymentOperationStatus && paymentOperationStatus.length > 0 && (
              <Card className="mt-4 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-blue-800">Payment Tracking</CardTitle>
                  <CardDescription>
                    Real-time status for operation: {currentPaymentOperation}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div><strong>Status:</strong> {paymentOperationStatus[0].status}</div>
                    <div><strong>External ID:</strong> {paymentOperationStatus[0].external_operation_id || 'Not assigned'}</div>
                    <div><strong>Last Updated:</strong> {new Date(paymentOperationStatus[0].updated_at).toLocaleString()}</div>
                    {paymentOperationStatus[0].error_message && (
                      <div><strong>Error:</strong> <span className="text-red-600">{paymentOperationStatus[0].error_message}</span></div>
                    )}
                    {paymentOperationStatus[0].paid_at && (
                      <div><strong>Paid At:</strong> {new Date(paymentOperationStatus[0].paid_at).toLocaleString()}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        
        {/* Add Provider Dialog */}
        <Dialog open={isAddProviderDialogOpen} onOpenChange={setIsAddProviderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {addProviderType === "tbank_test" ? "TBank Test" : "TBank Production"} Provider</DialogTitle>
              <DialogDescription>
                Configure your TBank payment provider credentials.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="provider-name">Provider Name</Label>
                <Input 
                  id="provider-name"
                  value={newProvider.name} 
                  onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminal-key">Terminal Key</Label>
                <Input 
                  id="terminal-key"
                  value={newProvider.terminal_key} 
                  onChange={(e) => setNewProvider({...newProvider, terminal_key: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-key">Secret Key</Label>
                <Input 
                  id="secret-key"
                  type="password"
                  value={newProvider.secret_key} 
                  onChange={(e) => setNewProvider({...newProvider, secret_key: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddProviderDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleProviderSubmit}>Add Provider</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Payment Method Dialog */}
        <Dialog open={isAddMethodDialogOpen} onOpenChange={setIsAddMethodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Add a new payment method for subscriptions and payments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="method-provider">Provider</Label>
                <Select value={newMethod.provider_id} onValueChange={(value) => setNewMethod({...newMethod, provider_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map((provider: PaymentProvider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.is_test_mode ? "Test" : "Production"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-key">Customer Key</Label>
                <Input 
                  id="customer-key"
                  value={newMethod.customer_key} 
                  onChange={(e) => setNewMethod({...newMethod, customer_key: e.target.value})}
                  placeholder="Unique customer identifier"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddMethodDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddMethodSubmit}>Add Method</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Plan Dialog */}
        <Dialog open={isAddPlanDialogOpen} onOpenChange={setIsAddPlanDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Subscription Plan</DialogTitle>
              <DialogDescription>
                Create a new subscription plan that users can subscribe to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-name">Plan Name</Label>
                  <Input 
                    id="plan-name"
                    value={newPlan.name} 
                    onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-price">Price</Label>
                  <Input 
                    id="plan-price"
                    type="number"
                    step="0.01"
                    value={newPlan.price} 
                    onChange={(e) => setNewPlan({...newPlan, price: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-description">Description</Label>
                <Textarea 
                  id="plan-description"
                  value={newPlan.description} 
                  onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-currency">Currency</Label>
                  <Select value={newPlan.currency} onValueChange={(value) => setNewPlan({...newPlan, currency: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RUB">RUB</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-interval">Interval</Label>
                  <Select value={newPlan.interval} onValueChange={(value) => setNewPlan({...newPlan, interval: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minute">Minute</SelectItem>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-interval-count">Count</Label>
                  <Input 
                    id="plan-interval-count"
                    type="number"
                    min="1"
                    value={newPlan.interval_count} 
                    onChange={(e) => setNewPlan({...newPlan, interval_count: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-trial">Trial Period (days)</Label>
                <Input 
                  id="plan-trial"
                  type="number"
                  min="0"
                  value={newPlan.trial_period_days} 
                  onChange={(e) => setNewPlan({...newPlan, trial_period_days: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-features">Features (JSON)</Label>
                <Textarea 
                  id="plan-features"
                  value={newPlan.features} 
                  onChange={(e) => setNewPlan({...newPlan, features: e.target.value})}
                  placeholder='{"feature1": true, "feature2": "value"}'
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddPlanDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPlanSubmit}>Create Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Subscription Dialog */}
        <Dialog open={isCreateSubscriptionDialogOpen} onOpenChange={setIsCreateSubscriptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Subscription</DialogTitle>
              <DialogDescription>
                Subscribe to {selectedPlanForSubscription?.name} plan.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {selectedPlanForSubscription && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Plan:</span>
                        <span className="font-medium">{selectedPlanForSubscription.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price:</span>
                        <span className="font-medium">{selectedPlanForSubscription.price} {selectedPlanForSubscription.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Billing:</span>
                        <span className="font-medium">Every {formatInterval(selectedPlanForSubscription.interval, selectedPlanForSubscription.interval_count)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-2">
                <Label htmlFor="subscription-method">Payment Method</Label>
                <Select value={newSubscription.method_id} onValueChange={(value) => setNewSubscription({...newSubscription, method_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods?.filter((method: PaymentMethod) => method.is_recurrent_ready && method.status === 'active').map((method: PaymentMethod) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.type} - {method.provider.name} {method.details?.pan && `(**** ${method.details.pan})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateSubscriptionDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSubscriptionSubmit}>Create Subscription</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment</DialogTitle>
              <DialogDescription>
                Create a one-time payment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="payment-provider">Provider</Label>
                <Select value={selectedProviderForPayment?.id || ""} onValueChange={(value) => {
                  const provider = providers?.find(p => p.id === value);
                  setSelectedProviderForPayment(provider || null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map((provider: PaymentProvider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.is_test_mode ? "Test" : "Production"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount</Label>
                <Input 
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  value={newPayment.amount} 
                  onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-currency">Currency</Label>
                <Select value={newPayment.currency} onValueChange={(value) => setNewPayment({...newPayment, currency: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RUB">RUB</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-description">Description</Label>
                <Input 
                  id="payment-description"
                  value={newPayment.description} 
                  onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
              <Button onClick={handlePaymentSubmit}>Create Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster />
    </SidebarLayout>
  );
} 