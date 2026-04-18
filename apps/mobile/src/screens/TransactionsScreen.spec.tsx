import { fireEvent } from "@testing-library/react-native";
import { TransactionsScreen } from "./TransactionsScreen";
import { renderMobile } from "../test/test-utils";

jest.mock("../hooks/use-customer-queries", () => ({
  useTransactionHistoryQuery: jest.fn()
}));

const { useTransactionHistoryQuery } = jest.requireMock(
  "../hooks/use-customer-queries"
) as {
  useTransactionHistoryQuery: jest.Mock;
};

describe("TransactionsScreen", () => {
  beforeEach(() => {
    useTransactionHistoryQuery.mockReturnValue({
      data: {
        intents: [
          {
            id: "dep-1",
            asset: {
              id: "eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            sourceWalletAddress: null,
            destinationWalletAddress: "0x1111111111111111111111111111111111111111",
            externalAddress: null,
            intentType: "deposit",
            status: "requested",
            policyDecision: "pending",
            requestedAmount: "1.25",
            settledAmount: null,
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-18T08:00:00.000Z",
            updatedAt: "2026-04-18T08:00:00.000Z",
            latestBlockchainTransaction: {
              id: "chain-1",
              txHash: "0xabc123",
              status: "broadcast",
              fromAddress: "0xaaaa",
              toAddress: "0xbbbb",
              createdAt: "2026-04-18T08:01:00.000Z",
              updatedAt: "2026-04-18T08:02:00.000Z",
              confirmedAt: null
            }
          },
          {
            id: "with-2",
            asset: {
              id: "usdc",
              symbol: "USDC",
              displayName: "USD Coin",
              decimals: 6,
              chainId: 1
            },
            sourceWalletAddress: "0x2222222222222222222222222222222222222222",
            destinationWalletAddress: null,
            externalAddress: "0x3333333333333333333333333333333333333333",
            intentType: "withdrawal",
            status: "queued",
            policyDecision: "approved",
            requestedAmount: "250",
            settledAmount: null,
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-18T09:00:00.000Z",
            updatedAt: "2026-04-18T09:00:00.000Z",
            latestBlockchainTransaction: null
          }
        ]
      },
      isError: false
    });
  });

  it("filters the list and opens the detail modal", () => {
    const screen = renderMobile(<TransactionsScreen />);

    fireEvent.changeText(
      screen.getByLabelText("Search by reference, amount, asset, or address"),
      "0x1111111111111111111111111111111111111111"
    );

    expect(screen.getByText("+1.25 ETH")).toBeTruthy();
    expect(screen.queryByText("-250 USDC")).toBeNull();

    fireEvent.press(screen.getByText("+1.25 ETH"));

    expect(screen.getByText("Internal reference")).toBeTruthy();
    expect(screen.getAllByText("0xabc123")).toHaveLength(2);
  });
});
