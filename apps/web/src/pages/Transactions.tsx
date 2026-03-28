
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { TransactionFilter } from "@/components/transactions/TransactionFilter";

interface Transaction {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
  address: string;
}

const Transactions = () => {
  const allTransactions = [
    {
      id: "1",
      type: "Deposit",
      amount: "+$1,000.00",
      date: "2024-03-20",
      status: "completed",
      address: "0x1234...5678",
    },
    {
      id: "2",
      type: "Withdrawal",
      amount: "-$500.00",
      date: "2024-03-19",
      status: "pending",
      address: "0x8765...4321",
    },
    {
      id: "3",
      type: "Transfer",
      amount: "-$250.00",
      date: "2024-03-18",
      status: "completed",
      address: "0x9876...1234",
    },
  ];

  const [filteredTransactions, setFilteredTransactions] = useState(allTransactions);

  const handleFilterChange = (filters: {
    search: string;
    types: string[];
    statuses: string[];
    dateRange: { from: Date | undefined; to: Date | undefined };
  }) => {
    let filtered = allTransactions;

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.type.toLowerCase().includes(searchLower) ||
          tx.amount.toLowerCase().includes(searchLower) ||
          tx.address.toLowerCase().includes(searchLower)
      );
    }

    // Filter by type
    if (filters.types.length > 0) {
      filtered = filtered.filter((tx) => filters.types.includes(tx.type));
    }

    // Filter by status
    if (filters.statuses.length > 0) {
      filtered = filtered.filter((tx) => filters.statuses.includes(tx.status));
    }

    // Filter by date range
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.date);
        if (filters.dateRange.from && filters.dateRange.to) {
          return txDate >= filters.dateRange.from && txDate <= filters.dateRange.to;
        } else if (filters.dateRange.from) {
          return txDate >= filters.dateRange.from;
        } else if (filters.dateRange.to) {
          return txDate <= filters.dateRange.to;
        }
        return true;
      });
    }

    setFilteredTransactions(filtered);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-foreground">Transactions</h1>
        
        <Card className="p-4 glass-card">
          <TransactionFilter onFilterChange={handleFilterChange} />
        </Card>

        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Address</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-mint-50/50">
                      <td className="px-6 py-4">{tx.type}</td>
                      <td className={`px-6 py-4 ${
                        tx.amount.startsWith("+") ? "text-mint-600" : "text-destructive"
                      }`}>
                        {tx.amount}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{tx.date}</td>
                      <td className="px-6 py-4 font-mono text-sm">{tx.address}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            tx.status === "completed"
                              ? "bg-mint-100 text-mint-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No transactions found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
        {filteredTransactions.length > 0 && (
          <div className="text-sm text-muted-foreground text-right">
            Showing {filteredTransactions.length} of {allTransactions.length} transactions
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Transactions;
