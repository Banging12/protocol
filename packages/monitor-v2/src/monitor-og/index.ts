import { delay } from "@uma/financial-templates-lib";
import { BotModes, initMonitoringParams, Logger, startupLogLevel, waitNextBlockRange } from "./common";
import {
  monitorProposalDeleted,
  monitorProposalExecuted,
  monitorSetCollateralAndBond,
  monitorSetEscalationManager,
  monitorSetIdentifier,
  monitorSetLiveness,
  monitorSetRules,
  monitorTransactionsExecuted,
  monitorTransactionsProposed,
} from "./MonitorEvents";

const logger = Logger;

async function main() {
  const params = await initMonitoringParams(process.env);

  logger[startupLogLevel(params)]({
    at: "OptimisticGovernorMonitor",
    message: "Optimistic Governor Monitor started 🔭",
    botModes: params.botModes,
  });

  const cmds = {
    transactionsProposedEnabled: monitorTransactionsProposed,
    transactionsExecutedEnabled: monitorTransactionsExecuted,
    proposalExecutedEnabled: monitorProposalExecuted,
    proposalDeletedEnabled: monitorProposalDeleted,
    setCollateralAndBondEnabled: monitorSetCollateralAndBond,
    setRulesEnabled: monitorSetRules,
    setLivenessEnabled: monitorSetLiveness,
    setIdentifierEnabled: monitorSetIdentifier,
    setEscalationManagerEnabled: monitorSetEscalationManager,
  };

  for (;;) {
    // In case of non-zero polling delay waitNextBlockRange at the end of the loop could have returned the starting block
    // to be greater than the ending block if there were no new blocks in the last polling delay. In this case we should
    // wait for the next block range before running the commands.
    if (params.blockRange.start > params.blockRange.end) {
      // In serverless it is possible for start block to be larger than end block if no new blocks were mined since last run.
      if (params.pollingDelay === 0) {
        await delay(5); // Set a delay to let the transports flush fully.
        break;
      }
      params.blockRange = await waitNextBlockRange(params);
      continue;
    }

    const runCmds = Object.entries(cmds)
      .filter(([mode]) => params.botModes[mode as keyof BotModes])
      .map(([, cmd]) => cmd(logger, params));

    await Promise.all(runCmds);

    // If polling delay is 0 then we are running in serverless mode and should exit after one iteration.
    if (params.pollingDelay === 0) {
      await delay(5); // Set a delay to let the transports flush fully.
      break;
    }
    params.blockRange = await waitNextBlockRange(params);
  }
}

main().then(
  () => {
    process.exit(0);
  },
  async (error) => {
    logger.error({
      at: "OptimisticGovernorMonitor",
      message: "Optimistic Governor Monitor execution error🚨",
      error,
    });
    await delay(5); // Wait 5 seconds to allow logger to flush.
    process.exit(1);
  }
);
