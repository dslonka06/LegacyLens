'use strict';

/**
 * DataFlowStepsNarrativeEngine — produces a description for each step in a
 * file's data flow, explaining the step's role within the sequence.
 *
 * Input shape:
 *   {
 *     steps:    string[],   // ordered step names e.g. ['parseRequest', 'validateInput', 'persist']
 *     inputs:   string[],
 *     outputs:  string[],
 *     language: string,
 *     fileType: string,
 *   }
 *
 * Output: string[] — one description per step, same order.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

function humanise(step) {
  return step.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
}

function nextStep(steps, i) {
  return i < steps.length - 1 ? humanise(steps[i + 1]) : null;
}

function prevStep(steps, i) {
  return i > 0 ? humanise(steps[i - 1]) : null;
}

function primaryInput(inputs) {
  return inputs.length > 0 ? inputs[0] : null;
}

function primaryOutput(outputs) {
  return outputs.length > 0 ? outputs[0] : null;
}

// ── Clusters ───────────────────────────────────────────────────────────────────

const STEP_CLUSTERS = [
  {
    keywords: ['parse', 'deserializ', 'decode', 'unmarshal', 'extract', 'read'],
    describe(step, i, steps, d) {
      const input   = primaryInput(d.inputs);
      const next    = nextStep(steps, i);
      const isFirst = i === 0;

      const what = input
        ? `Reads and structures the raw ${input} into an internal representation the rest of the flow can operate on.`
        : `Reads the raw input and structures it into an internal representation the rest of the flow can operate on.`;

      const gate = isFirst
        ? `As the entry point of this flow, any structural problem in the source data is caught or passed through here — nothing downstream can compensate for malformed input that gets past this step.`
        : `This parse operation restructures data that has already been partially processed — the incoming shape is defined by what ${prevStep(steps, i)} produced.`;

      const chain = next
        ? `The structured result feeds directly into ${next}.`
        : `The parsed output is the final form this flow produces.`;

      const risk = `Overly permissive parsing — accepting more than the schema requires — is a common source of unexpected behaviour in later steps.`;

      return `${what} ${gate} ${chain} ${risk}`;
    },
  },
  {
    keywords: ['valid', 'sanitiz', 'verify', 'check', 'enforce', 'assert', 'constrain', 'schema'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const total  = steps.length;
      const isLast = i === total - 1;

      const what = `Applies correctness rules to the data before it can advance further in the flow.`;

      const position = prev
        ? `It operates on the output of ${prev}, acting as a quality gate between that step and what follows.`
        : `As the opening step of the flow, this validation runs before any other logic has a chance to act on the data.`;

      const consequence = isLast
        ? `As the final step, a failure here is the last chance to prevent bad data from leaving this file entirely.`
        : next
          ? `If validation fails, ${next} — and everything after it — is bypassed, keeping invalid state contained to this point.`
          : `Any rejection here prevents the remaining steps from executing.`;

      const breadth = total > 4
        ? `With ${total} steps in this flow, a failure here has significant reach — it short-circuits a substantial pipeline.`
        : `In this compact ${total}-step flow, this gate carries proportionally high weight.`;

      return `${what} ${position} ${consequence} ${breadth}`;
    },
  },
  {
    keywords: ['transform', 'convert', 'map', 'format', 'normaliz', 'encode', 'adapt', 'reshape', 'serial'],
    describe(step, i, steps, d) {
      const prev    = prevStep(steps, i);
      const next    = nextStep(steps, i);
      const input   = primaryInput(d.inputs);
      const output  = primaryOutput(d.outputs);
      const isFirst = i === 0;
      const isLast  = i === steps.length - 1;

      const what = isFirst
        ? `Converts the incoming ${input ?? 'data'} into the internal shape this flow works with.`
        : isLast
          ? `Produces the final output form — converting internal results into ${output ?? 'the structure callers expect'}.`
          : `Translates the data from one representation to another, bridging what ${prev ?? 'the previous step'} produced and what ${next ?? 'the next step'} expects.`;

      const why = `Transformations isolate format concerns — if the source or target format changes, only this step needs updating.`;

      const risk = isLast
        ? `As the final transformation, any data loss or schema mismatch here directly affects the output this file produces.`
        : `Transformation errors tend to be silent — the data often passes structural checks downstream while carrying the wrong values.`;

      return `${what} ${why} ${risk}`;
    },
  },
  {
    keywords: ['auth', 'authoriz', 'authenticat', 'permission', 'role', 'access', 'token', 'credential', 'jwt'],
    describe(step, i, steps, d) {
      const next    = nextStep(steps, i);
      const prev    = prevStep(steps, i);
      const isFirst = i === 0;

      const what = `Verifies the caller's identity or permissions before allowing the flow to continue.`;

      const placement = isFirst
        ? `Positioned as the first step, this is the outermost security boundary — no other logic executes unless this passes.`
        : prev
          ? `Positioned after ${prev}, this step confirms that the context established earlier has the right to proceed.`
          : `This security check sits mid-flow, gating the remaining steps behind an access check.`;

      const downstream = next
        ? `Everything from ${next} onward executes under the assumption that this step confirmed authorisation — those steps should not need to re-check.`
        : `As the final step, this acts as an exit-gate — confirming permissions before the result is returned to the caller.`;

      const risk = `Authentication and authorisation failures are the most security-critical exit points in any flow. A bypass here exposes all downstream logic unconditionally.`;

      return `${what} ${placement} ${downstream} ${risk}`;
    },
  },
  {
    keywords: ['save', 'store', 'persist', 'insert', 'write', 'commit', 'upsert'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const output = primaryOutput(d.outputs);
      const isLast = i === steps.length - 1;

      const what = prev
        ? `Writes the data produced by ${prev} to persistent storage.`
        : `Writes the processed data to persistent storage.`;

      const consequence = isLast
        ? `As the final step, this is where the flow's work becomes durable — a failure here means the entire preceding pipeline must be retried or compensated for.`
        : next
          ? `This is not the final step — ${next} runs after, likely working with or referencing what was just persisted.`
          : `After this point the data is committed and cannot be easily rolled back.`;

      const output_note = output
        ? `The persisted result surfaces as ${output} for anything consuming this flow's output.`
        : `The persisted result is available to any downstream consumer of this flow.`;

      const risk = `Write operations are transactional boundaries — partial failure with no rollback leaves the system in an inconsistent state.`;

      return `${what} ${consequence} ${output_note} ${risk}`;
    },
  },
  {
    keywords: ['fetch', 'load', 'retriev', 'query', 'find', 'lookup'],
    describe(step, i, steps, d) {
      const next    = nextStep(steps, i);
      const prev    = prevStep(steps, i);
      const input   = primaryInput(d.inputs);
      const isFirst = i === 0;

      const what = isFirst
        ? `Retrieves the source data that the rest of this flow will operate on.`
        : `Fetches additional data mid-flow${prev ? `, informed by what ${prev} established` : ''}.`;

      const chain = next
        ? `The retrieved result is handed directly to ${next} — that step's behaviour depends entirely on what this retrieval returns.`
        : `This retrieval produces the final output of the flow.`;

      const criteria = input
        ? `The query is driven by ${input} as the lookup key or filter.`
        : `The retrieval criteria are defined by the context accumulated in earlier steps.`;

      const risk = `Empty or unexpected results here propagate silently — downstream steps often assume data was found and may fail in non-obvious ways when it wasn't.`;

      return `${what} ${chain} ${criteria} ${risk}`;
    },
  },
  {
    keywords: ['send', 'emit', 'publish', 'notify', 'dispatch', 'broadcast', 'deliver', 'push'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const output = primaryOutput(d.outputs);
      const isLast = i === steps.length - 1;

      const what = prev
        ? `Dispatches the output of ${prev} to an external consumer — another service, a queue, or a UI layer.`
        : `Dispatches data outward to an external consumer.`;

      const position = isLast
        ? `This is the exit point of the flow — once dispatched, the data is outside this file's control.`
        : next
          ? `This is not the final step — ${next} still runs after, likely handling the response or confirmation from the dispatch.`
          : `After dispatch, the flow has no further steps.`;

      const output_note = output
        ? `The payload sent is ${output}.`
        : `The dispatched payload is the accumulated result of the steps that preceded this one.`;

      const risk = `Dispatch failures are often silent at the call site — fire-and-forget patterns in particular give no indication whether the recipient processed the message.`;

      return `${what} ${position} ${output_note} ${risk}`;
    },
  },
  {
    keywords: ['calculat', 'comput', 'deriv', 'aggregat', 'evaluat', 'score', 'rank', 'resolv'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const isLast = i === steps.length - 1;
      const total  = steps.length;

      const what = `Applies business logic or computation to the data, producing a derived result that didn't exist in the inputs.`;

      const context = prev
        ? `It operates on what ${prev} produced, applying the core domain rules of this flow.`
        : `As the first step, the computation works directly on the raw inputs.`;

      const chain = isLast
        ? `The computed result is the final output of this flow.`
        : next
          ? `The result feeds into ${next}, which ${total - i - 1 > 1 ? `then continues through ${total - i - 1} more steps` : 'completes the flow'}.`
          : `The computed result moves on to the next step.`;

      const risk = `Computation steps concentrate business logic — bugs here produce wrong results that pass all structural checks and are hard to detect without domain-level testing.`;

      return `${what} ${context} ${chain} ${risk}`;
    },
  },
  {
    keywords: ['log', 'audit', 'trace', 'record', 'track', 'monitor'],
    describe(step, i, steps, d) {
      const prev = prevStep(steps, i);
      const next = nextStep(steps, i);

      const what = `Records the current state or event for observability — capturing what happened at this point in the flow without affecting any downstream behaviour.`;

      const placement = prev
        ? `It runs after ${prev}, capturing a snapshot of that step's outcome.`
        : `As the first step, this logs the incoming state before any processing begins.`;

      const chain = next
        ? `Execution continues to ${next} regardless of whether the log operation succeeds — logging is a non-blocking side effect.`
        : `As the final step, this produces an audit trail of the completed flow.`;

      const risk = `Logging is often treated as infallible, but if this step calls an external system — a log aggregator, database, or audit service — its failure can block the flow unless errors are silently swallowed.`;

      return `${what} ${placement} ${chain} ${risk}`;
    },
  },
  {
    keywords: ['error', 'catch', 'handl', 'recover', 'retry', 'fallback', 'fail'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const isLast = i === steps.length - 1;
      const total  = steps.length;

      const what = `Intercepts failure conditions and decides how the flow should respond — whether to recover and continue, return a safe default, or propagate the error cleanly.`;

      const placement = prev
        ? `It catches failures originating from ${prev}${i > 1 ? ` or anything earlier in the chain` : ''}.`
        : `Positioned at the start of the flow, this pre-emptively guards against invalid entry conditions.`;

      const consequence = isLast
        ? `As the final step, this is the last opportunity to ensure the flow exits in a known state — any unhandled case here becomes the caller's problem.`
        : next
          ? `If recovery succeeds, ${next} runs with a corrected or default state. If not, the error is propagated from here.`
          : `The decision made here determines whether any remaining steps execute.`;

      const risk = `Error handlers that silently swallow exceptions are particularly dangerous — they allow execution to continue with state that appears valid but is not.`;

      return `${what} ${placement} ${consequence} ${risk}`;
    },
  },
  {
    keywords: ['init', 'setup', 'bootstrap', 'prepar', 'configur', 'construct', 'creat'],
    describe(step, i, steps, d) {
      const next    = nextStep(steps, i);
      const isFirst = i === 0;
      const total   = steps.length;
      const input   = primaryInput(d.inputs);

      const what = isFirst
        ? `Establishes the initial state or context that all subsequent steps in this flow depend on.`
        : `Constructs or prepares an intermediate artifact that the steps following it require.`;

      const source = input
        ? `The setup draws on ${input} to build this initial context.`
        : `The initial context is built from the parameters and configuration available at the flow's entry point.`;

      const chain = next
        ? `${next} is the first consumer of what this step produces — if this step produces incomplete state, that gap will show up there.`
        : `This is also the final step, meaning the constructed artifact is directly the flow's output.`;

      const risk = `Initialisation failures tend to produce cascading errors — rather than a single clear failure, downstream steps report inconsistent symptoms that obscure the root cause.`;

      return `${what} ${source} ${chain} ${risk}`;
    },
  },
  {
    keywords: ['render', 'display', 'present', 'respond', 'format output', 'build response', 'generate response'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const output = primaryOutput(d.outputs);
      const isLast = i === steps.length - 1;
      const total  = steps.length;

      const what = `Shapes the result for the consumer — converting the internal data into the format the caller or UI layer expects.`;

      const context = prev
        ? `It receives the outcome of ${prev} and performs the final presentation transformation.`
        : `This is the only step before the result leaves the file.`;

      const position = isLast
        ? `As the last of ${total} steps, this is where all prior processing becomes visible output.`
        : `Despite being a presentation step, it runs before the flow is complete — subsequent steps may further wrap or route this rendered output.`;

      const output_note = output
        ? `The produced output is ${output}.`
        : `The rendered result is returned directly to whatever invoked this flow.`;

      return `${what} ${context} ${position} ${output_note}`;
    },
  },
  {
    keywords: ['update', 'patch', 'modify', 'edit', 'merg'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const isLast = i === steps.length - 1;

      const what = `Applies partial changes to existing data rather than replacing it wholesale.`;

      const context = prev
        ? `The change set comes from ${prev} — this step applies those deltas to the existing record.`
        : `As the first step, the incoming payload itself defines the changes to apply.`;

      const consequence = isLast
        ? `As the final step, the updated state is the flow's output — callers receive or observe the post-update version.`
        : next
          ? `After the update, ${next} operates on the modified state — it should not assume the pre-update values are still accessible.`
          : `The modified state moves forward through the remaining steps.`;

      const risk = `Partial update patterns carry merge-conflict risk — concurrent flows patching the same record can produce inconsistent final state if no locking or optimistic concurrency is in place.`;

      return `${what} ${context} ${consequence} ${risk}`;
    },
  },
  {
    keywords: ['delet', 'remov', 'destroy', 'clean', 'purg'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const isLast = i === steps.length - 1;

      const what = `Removes data from the system — a destructive, typically irreversible operation.`;

      const context = prev
        ? `The target of the deletion is identified by ${prev}, which narrowed the scope to a specific record or set.`
        : `This step begins by identifying what to remove, then performs the deletion.`;

      const consequence = isLast
        ? `As the final step, once this completes the flow has no further data to work with — the deleted resource is gone.`
        : next
          ? `${next} runs after the deletion and must not attempt to read or reference what was just removed.`
          : `Steps that follow must not assume the deleted resource is still accessible.`;

      const risk = `Deletions that cascade to related records can produce wider side-effects than intended. Without a soft-delete or audit trail, recovery from an incorrect deletion requires a database restore.`;

      return `${what} ${context} ${consequence} ${risk}`;
    },
  },
  {
    keywords: ['enrich', 'decorate', 'annotat', 'augment', 'supplement'],
    describe(step, i, steps, d) {
      const prev   = prevStep(steps, i);
      const next   = nextStep(steps, i);
      const isLast = i === steps.length - 1;
      const total  = steps.length;

      const what = `Adds additional context or data to the current payload, making it richer for downstream steps without altering its fundamental structure.`;

      const source = prev
        ? `The base payload comes from ${prev} — this step layers additional data on top without replacing anything ${i > 1 ? 'the earlier steps established' : 'it received'}.`
        : `The enrichment draws on external sources to supplement the incoming payload.`;

      const chain = isLast
        ? `The enriched result is the final output of this flow — everything added here is part of what callers receive.`
        : next
          ? `${next} operates on the enriched payload and can rely on the additional context this step provides.`
          : `The enriched payload continues through the remaining ${total - i - 1} step${total - i - 1 !== 1 ? 's' : ''}.`;

      const risk = `Enrichment steps that call external services add latency and a new failure surface — if the enrichment source is unavailable, the step must decide whether to fail the flow or continue with a partial payload.`;

      return `${what} ${source} ${chain} ${risk}`;
    },
  },
];

// ── Engine ─────────────────────────────────────────────────────────────────────

class DataFlowStepsNarrativeEngine {

  build(data) {
    const { steps = [], inputs = [], outputs = [], language = 'Unknown', fileType = 'file' } = data;
    return steps.map((step, i) => this._describeStep(step, i, steps, { inputs, outputs, language, fileType }));
  }

  _describeStep(step, i, steps, d) {
    const lower    = step.toLowerCase();
    const expanded = lower.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

    for (const cluster of STEP_CLUSTERS) {
      if (cluster.keywords.some(kw => lower.includes(kw) || expanded.includes(kw))) {
        return cluster.describe(step, i, steps, d);
      }
    }

    // Fallback: positional context with adjacent step awareness
    const cleaned  = humanise(step);
    const prev     = prevStep(steps, i);
    const next     = nextStep(steps, i);
    const isFirst  = i === 0;
    const isLast   = i === steps.length - 1;

    const what = isFirst
      ? `Opens the flow by handling "${cleaned}" — the data and context produced here sets the shape for everything that follows.`
      : isLast
        ? `Closes the flow by handling "${cleaned}" — this is where the pipeline's accumulated work becomes the final result.`
        : `Handles "${cleaned}" as an intermediate step, taking the output of ${prev} and preparing it for ${next}.`;

    const chain = prev && next
      ? `It receives from ${prev} and passes its result on to ${next}.`
      : prev
        ? `It receives from ${prev} and its output is the final result of this flow.`
        : next
          ? `As the opening step, it provides the initial data for ${next}.`
          : `It is the only step in this flow.`;

    const io = d.inputs.length > 0 && isFirst
      ? `The flow starts with ${d.inputs.slice(0, 2).join(' and ')} as its input${d.inputs.length > 1 ? 's' : ''}.`
      : d.outputs.length > 0 && isLast
        ? `The flow produces ${d.outputs.slice(0, 2).join(' and ')} as its output${d.outputs.length > 1 ? 's' : ''}.`
        : '';

    return [what, chain, io].filter(Boolean).join(' ');
  }
}

module.exports = { DataFlowStepsNarrativeEngine };
