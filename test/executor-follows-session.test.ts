import { describe, expect, test } from "bun:test";

import {
  effectiveExecutorEffort,
  effectiveExecutorRef,
} from "../src/child-session.ts";
import { registerCommands } from "../src/commands.ts";
import { loadConfig } from "../src/config.ts";
import { savedConfig, withAgentDir } from "./helpers/config-fixture.ts";
import { asExtensionContext } from "./helpers/extension-context.ts";
import { activationContext, activationHarness } from "./helpers/harness.ts";

const sessionModel = { id: "session", provider: "omp" };

describe("Executor follows the session model", () => {
  test("activation keeps the session model when no Executor is configured", async () => {
    await withAgentDir({ advisor: "provider/advisor" }, async (agentDir) => {
      const { commands, events, pi, selectedModels, setActiveTools } =
        activationHarness();

      registerCommands(pi);
      setActiveTools([]);
      const notes: string[] = [];
      const ctx = activationContext(agentDir, notes);
      await events.get("session_start")?.({ reason: "startup" }, ctx);

      await commands.get("advisor").handler("", ctx);

      expect(selectedModels).toEqual([]);
      expect(pi.getActiveTools()).toContain("ask_advisor");
      expect(savedConfig(agentDir)).not.toHaveProperty("executor");
      expect(notes.join("\n")).not.toContain("not configured");
    });
  });

  test("a /model selection is not persisted as the Executor", async () => {
    await withAgentDir({ advisor: "provider/advisor" }, async (agentDir) => {
      const { commands, events, pi, selectedModels, setActiveTools } =
        activationHarness();

      registerCommands(pi);
      setActiveTools([]);
      const ctx = activationContext(agentDir);
      await events.get("session_start")?.({ reason: "startup" }, ctx);

      events.get("model_select")?.(
        { model: { id: "luna", provider: "provider" }, source: "set" },
        ctx
      );
      await commands.get("advisor").handler("", ctx);
      events.get("model_select")?.(
        { model: { id: "sol", provider: "provider" }, source: "set" },
        ctx
      );

      expect(selectedModels).toEqual([]);
      expect(savedConfig(agentDir)).not.toHaveProperty("executor");
    });
  });

  test("an explicit /advisor executor override still switches models", async () => {
    await withAgentDir({ advisor: "provider/advisor" }, async (agentDir) => {
      const { commands, events, pi, selectedModels, setActiveTools } =
        activationHarness();

      registerCommands(pi);
      setActiveTools([]);
      const ctx = activationContext(agentDir);
      await events.get("session_start")?.({ reason: "startup" }, ctx);

      await commands.get("advisor").handler("executor=provider/pinned", ctx);

      expect(selectedModels).toEqual([{ id: "pinned", provider: "provider" }]);
      expect(savedConfig(agentDir).executor).toBe("provider/pinned");
    });
  });

  test("effective Executor resolves to the session model unless configured", async () => {
    await withAgentDir({}, async (agentDir) => {
      const ctx = asExtensionContext({
        cwd: agentDir,
        isProjectTrusted: () => false,
        model: sessionModel,
        thinkingLevel: "high",
      });

      loadConfig(ctx);
      expect(effectiveExecutorRef(ctx)).toBe("omp/session");
      expect(effectiveExecutorEffort(ctx)).toBe("high");
    });
    await withAgentDir(
      { executor: "provider/pinned", executorEffort: "low" },
      async (agentDir) => {
        const ctx = asExtensionContext({
          cwd: agentDir,
          isProjectTrusted: () => false,
          model: sessionModel,
          thinkingLevel: "high",
        });

        loadConfig(ctx);
        expect(effectiveExecutorRef(ctx)).toBe("provider/pinned");
        expect(effectiveExecutorEffort(ctx)).toBe("low");
      }
    );
  });
});
