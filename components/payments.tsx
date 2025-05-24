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
import { Button } from "hasyx/components/ui/button";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "hasyx/components/ui/table";
import { SidebarData } from "hasyx/components/sidebar";
import { toast, Toaster } from "sonner";
import { useHasyx } from "hasyx/lib";
import { format } from "date-fns";
import { PlusCircle } from "lucide-react";

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
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

export default function Payments({ sidebarData }: PaymentsProps) {
  const [tabValue, setTabValue] = useState("terminals");
  const [operationsTab, setOperationsTab] = useState("payments");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addProviderType, setAddProviderType] = useState<"tbank_test" | "tbank_prod" | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedProviderForPayment, setSelectedProviderForPayment] = useState<PaymentProvider | null>(null);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: "",
    terminal_key: "",
    secret_key: "",
  });
  const [newPayment, setNewPayment] = useState({
    amount: "",
    currency: "RUB",
    description: "",
  });
  const [currentPaymentOperation, setCurrentPaymentOperation] = useState<string | null>(null);

  const hasyx = useHasyx();
  
  // Subscription for providers
  const { data: providers, loading: providersLoading, error: providersError } = hasyx.useSubscription({
    table: "payments_providers",
    returning: ["id", "name", "type", "is_test_mode", "created_at"],
    order_by: { created_at: "desc" },
  });

  // Query for available providers when creating payment (only when menu is open)
  const { data: availableProviders, loading: availableProvidersLoading } = hasyx.useQuery({
    table: "payments_providers",
    returning: ["id", "name", "type", "is_test_mode"],
    where: { is_active: { _eq: true } },
    order_by: { name: "asc" },
  });

  // Subscription for operations (filtered by provider_id if selected)
  const operationsQuery = {
    table: "payments_operations",
    returning: ["id", "user_id", "amount", "currency", "status", "description", "method_id", "provider_id", "created_at", "subscription_id"],
    order_by: { created_at: "desc" },
    ...(selectedProviderId ? { where: { provider_id: { _eq: selectedProviderId } } } : {}),
  };
  const { data: operations, loading: operationsLoading, error: operationsError } = hasyx.useSubscription(operationsQuery);

  // Subscription for subscriptions (filtered by provider_id if selected)
  const subscriptionsQuery = {
    table: "payments_subscriptions",
    returning: ["id", "user_id", "method_id", "provider_id", "status", "current_period_start", "current_period_end", "created_at"],
    order_by: { created_at: "desc" },
    ...(selectedProviderId ? { where: { provider_id: { _eq: selectedProviderId } } } : {}),
  };
  const { data: subscriptions, loading: subscriptionsLoading, error: subscriptionsError } = hasyx.useSubscription(subscriptionsQuery);

  // Subscription for tracking current payment operation
  const { data: paymentOperationStatus } = hasyx.useSubscription({
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

  const handleProviderSelect = (providerId: string) => {
    setSelectedProviderId(providerId);
    setTabValue("operations");
  };

  const handleAddProviderClick = (type: "tbank_test" | "tbank_prod") => {
    setAddProviderType(type);
    setNewProvider({
      name: type === "tbank_test" ? "TBank Test" : "TBank Production",
      terminal_key: "",
      secret_key: "",
    });
    setIsAddDialogOpen(true);
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

      toast.success(`Added ${newProvider.name} provider`);
      setIsAddDialogOpen(false);
    } catch (error) {
      toast.error("Failed to add provider");
      console.error("Error adding provider:", error);
    }
  };

  const handlePaymentProviderSelect = (provider: PaymentProvider) => {
    setSelectedProviderForPayment(provider);
    setIsProviderMenuOpen(false);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!newPayment.amount || !newPayment.description || !selectedProviderForPayment) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      // Create payment operation
      const result = await hasyx.insert({
        table: "payments_operations",
        object: {
          provider_id: selectedProviderForPayment.id,
          amount: parseFloat(newPayment.amount),
          currency: newPayment.currency,
          status: "pending_initiation",
          description: newPayment.description,
        },
        returning: ["id"],
      });

      const operationId = result.data?.[0]?.id;
      
      if (operationId) {
        // Start tracking this payment operation
        setCurrentPaymentOperation(operationId);
        
        // Initialize payment with TBank
        const response = await fetch(`/api/payments/tbank/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation_id: operationId,
            provider_id: selectedProviderForPayment.id,
          }),
        });

        if (response.ok) {
          const { payment_url } = await response.json();
          toast.success("Payment created successfully");
          setIsPaymentDialogOpen(false);
          setNewPayment({ amount: "", currency: "RUB", description: "" });
          setSelectedProviderForPayment(null);
          
          // Open payment URL
          if (payment_url) {
            window.open(payment_url, '_blank');
            toast.info("Complete payment in the opened window. Status will update automatically.");
          }
        } else {
          const errorData = await response.json();
          setCurrentPaymentOperation(null); // Stop tracking on error
          throw new Error(errorData.error || 'Failed to initialize payment');
        }
      }
    } catch (error) {
      toast.error(`Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error("Error creating payment:", error);
      setCurrentPaymentOperation(null); // Stop tracking on error
    }
  };

  const breadcrumb = [
    { title: "Home", link: "/" },
    { title: "Payments" },
  ];

  return (
    <SidebarLayout sidebarData={sidebarData} breadcrumb={breadcrumb}>
      <Toaster position="top-right" />
      <div className="flex flex-1 flex-col">
        <Tabs value={tabValue} onValueChange={setTabValue} className="w-full h-full">
          <TabsList className="w-full justify-start px-4 py-2 border-b">
            <TabsTrigger value="terminals">Terminals</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="terminals" className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providersLoading ? (
                <div>Loading terminals...</div>
              ) : providersError ? (
                <div>Error loading terminals</div>
              ) : providers && providers.length > 0 ? (
                providers.map((provider: PaymentProvider) => (
                  <Card 
                    key={provider.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleProviderSelect(provider.id)}
                  >
                    <CardHeader>
                      <CardTitle>{provider.name}</CardTitle>
                      <CardDescription>ID: {provider.id}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>Type: {provider.type}</div>
                        <div>Mode: {provider.is_test_mode ? "Test" : "Production"}</div>
                        <div>Added: {format(new Date(provider.created_at), "PPP")}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div>No payment terminals found</div>
              )}
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add {addProviderType === "tbank_test" ? "TBank Test" : "TBank Production"} Terminal</DialogTitle>
                    <DialogDescription>
                      Enter the credentials for your TBank terminal. You can find these in your TBank merchant dashboard.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Terminal Name</Label>
                      <Input 
                        id="name" 
                        value={newProvider.name} 
                        onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="terminal_key">Terminal Key</Label>
                      <Input 
                        id="terminal_key" 
                        value={newProvider.terminal_key} 
                        onChange={(e) => setNewProvider({...newProvider, terminal_key: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secret_key">Secret Key</Label>
                      <Input 
                        id="secret_key" 
                        type="password"
                        value={newProvider.secret_key} 
                        onChange={(e) => setNewProvider({...newProvider, secret_key: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleProviderSubmit}>Add Terminal</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                size="icon" 
                className="absolute bottom-4 right-4 rounded-full w-12 h-12"
                onClick={() => {
                  const menu = document.createElement("div");
                  menu.innerHTML = `
                    <div class="absolute bottom-16 right-4 bg-background border rounded-lg shadow-lg p-2 space-y-2 w-48">
                      <button class="w-full text-left px-3 py-2 hover:bg-muted rounded-md" onclick="document.dispatchEvent(new CustomEvent('tbank_test_click'))">TBank Test</button>
                      <button class="w-full text-left px-3 py-2 hover:bg-muted rounded-md" onclick="document.dispatchEvent(new CustomEvent('tbank_prod_click'))">TBank Production</button>
                    </div>
                  `;
                  document.body.appendChild(menu);
                  
                  const handleClick = (e: MouseEvent) => {
                    if (!menu.contains(e.target as Node)) {
                      document.body.removeChild(menu);
                      document.removeEventListener("click", handleClick);
                    }
                  };

                  const handleTBankTestClick = () => {
                    document.body.removeChild(menu);
                    document.removeEventListener("click", handleClick);
                    handleAddProviderClick("tbank_test");
                  };

                  const handleTBankProdClick = () => {
                    document.body.removeChild(menu);
                    document.removeEventListener("click", handleClick);
                    handleAddProviderClick("tbank_prod");
                  };

                  document.addEventListener("click", handleClick);
                  document.addEventListener("tbank_test_click", handleTBankTestClick, { once: true });
                  document.addEventListener("tbank_prod_click", handleTBankProdClick, { once: true });
                }}
              >
                <PlusCircle className="h-6 w-6" />
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="operations" className="flex flex-col">
            <Tabs value={operationsTab} onValueChange={setOperationsTab} className="w-full h-full">
              <TabsList className="w-full justify-start px-4 py-2 border-b">
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="payments" className="p-4 overflow-auto">
                {selectedProviderId && (
                  <div className="mb-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Selected Terminal: {providers?.find(p => p.id === selectedProviderId)?.name || selectedProviderId}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                )}
                
                {operationsLoading ? (
                  <div>Loading payments...</div>
                ) : operationsError ? (
                  <div>Error loading payments</div>
                ) : operations && operations.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operations.map((operation: PaymentOperation) => (
                          <TableRow key={operation.id}>
                            <TableCell className="font-medium">{operation.id.substring(0, 8)}...</TableCell>
                            <TableCell>{operation.user_id.substring(0, 8)}...</TableCell>
                            <TableCell>{operation.amount} {operation.currency}</TableCell>
                            <TableCell>{operation.status}</TableCell>
                            <TableCell>{operation.description || "-"}</TableCell>
                            <TableCell>{format(new Date(operation.created_at), "PPP")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div>No payments found</div>
                )}

                {/* Diagnostic Information */}
                {currentPaymentOperation && paymentOperationStatus && paymentOperationStatus.length > 0 && (
                  <Card className="mt-4 border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-blue-800">Payment Tracking - Diagnostic Info</CardTitle>
                      <CardDescription>
                        Real-time status tracking for payment operation: {currentPaymentOperation}
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
                        {paymentOperationStatus[0].provider_response_details && (
                          <details className="mt-2">
                            <summary className="cursor-pointer font-medium">Provider Response Details</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(paymentOperationStatus[0].provider_response_details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Creation Dialog */}
                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Payment - {selectedProviderForPayment?.name}</DialogTitle>
                      <DialogDescription>
                        Create a new payment using {selectedProviderForPayment?.type} provider.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input 
                          id="amount" 
                          type="number"
                          step="0.01"
                          min="0"
                          value={newPayment.amount} 
                          onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Input 
                          id="currency" 
                          value={newPayment.currency} 
                          onChange={(e) => setNewPayment({...newPayment, currency: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input 
                          id="description" 
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

                {/* Add Payment Button */}
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="absolute bottom-4 right-4 rounded-full w-12 h-12"
                  onClick={() => setIsProviderMenuOpen(true)}
                >
                  <PlusCircle className="h-6 w-6" />
                </Button>

                {/* Provider Selection Menu */}
                {isProviderMenuOpen && (
                  <div 
                    className="fixed inset-0 bg-black/20 z-40"
                    onClick={() => setIsProviderMenuOpen(false)}
                  >
                    <div 
                      className="absolute bottom-16 right-4 bg-background border rounded-lg shadow-lg p-2 space-y-2 w-48 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                        Select Provider
                      </div>
                      {availableProvidersLoading ? (
                        <div className="px-3 py-2 text-sm">Loading...</div>
                      ) : availableProviders && availableProviders.length > 0 ? (
                        availableProviders.map((provider: PaymentProvider) => (
                          <button 
                            key={provider.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted rounded-md text-sm"
                            onClick={() => handlePaymentProviderSelect(provider)}
                          >
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {provider.type} • {provider.is_test_mode ? "Test" : "Production"}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No providers available
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="subscriptions" className="p-4 overflow-auto">
                {selectedProviderId && (
                  <div className="mb-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Selected Terminal: {providers?.find(p => p.id === selectedProviderId)?.name || selectedProviderId}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                )}
                
                {subscriptionsLoading ? (
                  <div>Loading subscriptions...</div>
                ) : subscriptionsError ? (
                  <div>Error loading subscriptions</div>
                ) : subscriptions && subscriptions.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Current Period</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((subscription: Subscription) => (
                          <TableRow key={subscription.id}>
                            <TableCell className="font-medium">{subscription.id.substring(0, 8)}...</TableCell>
                            <TableCell>{subscription.user_id.substring(0, 8)}...</TableCell>
                            <TableCell>{subscription.status}</TableCell>
                            <TableCell>
                              {subscription.current_period_start && subscription.current_period_end 
                                ? `${format(new Date(subscription.current_period_start), "MMM d")} - ${format(new Date(subscription.current_period_end), "MMM d, yyyy")}`
                                : "Not active"}
                            </TableCell>
                            <TableCell>{format(new Date(subscription.created_at), "PPP")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div>No subscriptions found</div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
} 