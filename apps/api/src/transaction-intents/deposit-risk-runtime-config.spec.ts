import { loadDepositRiskPolicyRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadDepositRiskPolicyRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["DEPOSIT_AUTO_APPROVE_THRESHOLDS_JSON"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults to operator review for all deposits when thresholds are unset", () => {
    const result = loadDepositRiskPolicyRuntimeConfig(process.env);

    expect(result).toEqual({
      autoApproveThresholds: []
    });
  });

  it("parses per-asset automatic approval thresholds", () => {
    process.env["DEPOSIT_AUTO_APPROVE_THRESHOLDS_JSON"] = JSON.stringify([
      {
        assetSymbol: "usdc",
        maxRequestedAmount: "1000"
      },
      {
        assetSymbol: "ETH",
        maxRequestedAmount: "0.25"
      }
    ]);

    const result = loadDepositRiskPolicyRuntimeConfig(process.env);

    expect(result).toEqual({
      autoApproveThresholds: [
        {
          assetSymbol: "USDC",
          maxRequestedAmount: "1000"
        },
        {
          assetSymbol: "ETH",
          maxRequestedAmount: "0.25"
        }
      ]
    });
  });

  it("rejects invalid threshold payloads", () => {
    process.env["DEPOSIT_AUTO_APPROVE_THRESHOLDS_JSON"] = JSON.stringify([
      {
        assetSymbol: "USDC",
        maxRequestedAmount: "-1"
      }
    ]);

    expect(() => loadDepositRiskPolicyRuntimeConfig(process.env)).toThrow(
      "DEPOSIT_AUTO_APPROVE_THRESHOLDS_JSON[0].maxRequestedAmount must be a positive decimal string."
    );
  });
});
