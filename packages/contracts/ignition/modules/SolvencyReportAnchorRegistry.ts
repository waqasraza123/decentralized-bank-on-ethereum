import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SolvencyReportAnchorRegistryModule = buildModule(
  "SolvencyReportAnchorRegistryModule",
  (m) => {
    const governanceSafe = m.getParameter("governanceSafe");
    const authorizedAnchorer = m.getParameter("authorizedAnchorer");
    const registry = m.contract("SolvencyReportAnchorRegistry", [
      governanceSafe,
      authorizedAnchorer
    ]);

    return {
      registry
    };
  }
);

export default SolvencyReportAnchorRegistryModule;
