# Session telemetry contract

**Total prompt-to-final-answer elapsed time is the primary metric.** The extension uses Node's monotonic `performance.now()`. Calendar timestamps do not determine elapsed durations.

Finalized assistant entries gain `message.telemetry` through Pi's supported `message_end` replacement hook, before persistence. `session-telemetry.turn` custom entries link that response to its tools; `session-telemetry.run` records the final result. `/telemetry` displays the latest branch summary without making a model request.

| Field | Interpretation |
|---|---|
| `total_latency_ms` | Since the input hook, falling back to run-start. Assistant records end at response completion; turn records end after tools; final run records end at the last response or terminal tool completion. |
| `turn_latency_ms` | Since this particular Pi model/tool-loop turn began. A prompt can have several Pi turns. |
| `tool_execution_ms` | Sum of Pi-measured tool execution durations. Parallel/nested calls can overlap. |
| `top_level_tool_execution_ms` | Tool sum excluding nested calls to avoid parent/child double counting. |
| `tool_wall_ms` | Union of observed tool intervals, including event/approval overhead, counted once across overlapping calls. |
| `thought_time_ms` | Observed thinking-stream phase wall time; `null` when not emitted. Incomplete phases are flagged. |
| `internal_reasoning_compute_ms` | Always `null`: hidden GPU compute, network delay and prefill cannot be separated by client hooks. |

Fields are cumulative within one run and identify their scope, run ID, turn number, stop reason and status. A response that proposes a tool cannot include its future execution time; its following turn/run record does. Numeric timings are rounded to 0.001 ms without promising that timer accuracy. Pi may already round native tool durations to integer milliseconds. ISO timestamps are anchored at starting wall time plus monotonic elapsed time.

The session manager is authoritative for the file path. `PI_SESSION_FILE` is normally injected into shell tools when they start; the worker environment need not contain it. A stale value is noted and ignored. Ephemeral sessions remain in memory. Writes use Pi's existing synchronous single-process session writer, preserving entry graphs and resume behavior. This is not a cross-process filesystem lock: never let two writers open the same session file.

Diagnostics do not include prompt/reasoning text, tool arguments or output and do not enter provider messages. Only calls routed through Pi's tool lifecycle have individual timings. Raw extension subprocesses are not independently observable. Queued-input delay before hook delivery and completion after a hard process crash cannot be reconstructed. Existing historical entries are not retroactively rewritten. Revalidate message metadata preservation after upgrading the pinned SDK.
