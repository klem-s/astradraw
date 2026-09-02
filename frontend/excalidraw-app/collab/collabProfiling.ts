/* eslint-disable no-console */
/**
 * Collaboration Performance Profiling
 *
 * This module intentionally uses console.log/console.group for profiling output.
 *
 * === QUICK START ===
 *
 * 1. Enable profiling (in browser console):
 *    window.COLLAB_PROFILING = true;
 *
 * 2. Collaborate with another user for 30-60 seconds
 *    (move cursor around, draw shapes, etc.)
 *
 * 3. View stats in console:
 *    window.COLLAB_PROFILING_STATS();
 *
 * 4. Export report for AI analysis:
 *    window.COLLAB_PROFILING_EXPORT();
 *    (Downloads a JSON file you can share)
 *
 * 5. Copy report to clipboard:
 *    window.COLLAB_PROFILING_COPY();
 *    (Copies markdown report to clipboard)
 *
 * === COMMANDS ===
 *
 * window.COLLAB_PROFILING = true/false  - Enable/disable profiling
 * window.COLLAB_PROFILING_STATS()       - Show stats table in console
 * window.COLLAB_PROFILING_EXPORT()      - Download JSON report
 * window.COLLAB_PROFILING_COPY()        - Copy markdown to clipboard
 * window.COLLAB_PROFILING_CLEAR()       - Clear all collected data
 * window.COLLAB_PROFILING_RAW()         - Get raw timing samples
 */

declare global {
  interface Window {
    COLLAB_PROFILING?: boolean;
    COLLAB_PROFILING_STATS?: () => void;
    COLLAB_PROFILING_EXPORT?: () => void;
    COLLAB_PROFILING_COPY?: () => Promise<void>;
    COLLAB_PROFILING_CLEAR?: () => void;
    COLLAB_PROFILING_RAW?: () => RawTimingSample[];
  }
}

interface TimingEntry {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  samples: number[]; // Keep last N samples for percentile analysis
}

interface RawTimingSample {
  label: string;
  ms: number;
  timestamp: number;
}

interface ProfilingReport {
  generatedAt: string;
  durationSeconds: number;
  userAgent: string;
  summary: {
    totalMessages: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
  timings: Array<{
    label: string;
    count: number;
    avgMs: string;
    minMs: string;
    maxMs: string;
    p50Ms: string;
    p95Ms: string;
    p99Ms: string;
    totalMs: string;
  }>;
  rawSamples: RawTimingSample[];
  analysis: string;
}

const MAX_SAMPLES = 1000; // Keep last 1000 samples per label
const timings: Map<string, TimingEntry> = new Map();
const rawSamples: RawTimingSample[] = [];
let profilingStartTime: number | null = null;

export function isProfilingEnabled(): boolean {
  return typeof window !== "undefined" && window.COLLAB_PROFILING === true;
}

export function profileStart(label: string): number {
  if (!isProfilingEnabled()) {
    return 0;
  }

  // Track when profiling started
  if (profilingStartTime === null) {
    profilingStartTime = Date.now();
    console.log(
      "[Collab Profiling] Started collecting data. Move cursor, draw shapes, collaborate!",
    );
  }

  return performance.now();
}

export function profileEnd(label: string, startTime: number): void {
  if (!isProfilingEnabled() || startTime === 0) {
    return;
  }

  const elapsed = performance.now() - startTime;

  // Store raw sample
  rawSamples.push({
    label,
    ms: elapsed,
    timestamp: Date.now(),
  });

  // Keep only last 10000 raw samples total
  if (rawSamples.length > 10000) {
    rawSamples.shift();
  }

  // Aggregate stats
  const existing = timings.get(label) || {
    count: 0,
    totalMs: 0,
    minMs: Infinity,
    maxMs: 0,
    samples: [],
  };

  existing.samples.push(elapsed);
  if (existing.samples.length > MAX_SAMPLES) {
    existing.samples.shift();
  }

  timings.set(label, {
    count: existing.count + 1,
    totalMs: existing.totalMs + elapsed,
    minMs: Math.min(existing.minMs, elapsed),
    maxMs: Math.max(existing.maxMs, elapsed),
    samples: existing.samples,
  });
}

export function profileAsync<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isProfilingEnabled()) {
    return fn();
  }

  const start = profileStart(label);
  return fn().finally(() => profileEnd(label, start));
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) {
    return 0;
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function generateReport(): ProfilingReport {
  const durationSeconds = profilingStartTime
    ? (Date.now() - profilingStartTime) / 1000
    : 0;

  const timingRows = Array.from(timings.entries())
    .map(([label, stats]) => ({
      label,
      count: stats.count,
      avgMs: (stats.totalMs / stats.count).toFixed(2),
      minMs: stats.minMs.toFixed(2),
      maxMs: stats.maxMs.toFixed(2),
      p50Ms: percentile(stats.samples, 50).toFixed(2),
      p95Ms: percentile(stats.samples, 95).toFixed(2),
      p99Ms: percentile(stats.samples, 99).toFixed(2),
      totalMs: stats.totalMs.toFixed(2),
    }))
    .sort((a, b) => parseFloat(b.avgMs) - parseFloat(a.avgMs));

  // Calculate summary from client-broadcast:total if available
  const totalEntry = timings.get("client-broadcast:total");
  const summary = {
    totalMessages: totalEntry?.count || 0,
    avgLatencyMs: totalEntry ? totalEntry.totalMs / totalEntry.count : 0,
    p95LatencyMs: totalEntry ? percentile(totalEntry.samples, 95) : 0,
    p99LatencyMs: totalEntry ? percentile(totalEntry.samples, 99) : 0,
  };

  // Generate analysis text
  const analysis = generateAnalysis(timingRows, summary, durationSeconds);

  return {
    generatedAt: new Date().toISOString(),
    durationSeconds,
    userAgent: navigator.userAgent,
    summary,
    timings: timingRows,
    rawSamples: rawSamples.slice(-500), // Include last 500 samples
    analysis,
  };
}

function generateAnalysis(
  timingRows: ProfilingReport["timings"],
  summary: ProfilingReport["summary"],
  durationSeconds: number,
): string {
  const lines: string[] = [];

  lines.push("## Collaboration Performance Analysis\n");
  lines.push(`**Duration:** ${durationSeconds.toFixed(1)} seconds`);
  lines.push(
    `**Total cursor/state updates received:** ${summary.totalMessages}`,
  );
  lines.push(
    `**Messages per second:** ${(
      summary.totalMessages / Math.max(1, durationSeconds)
    ).toFixed(1)}`,
  );
  lines.push("");

  if (summary.totalMessages > 0) {
    lines.push("### Latency Summary");
    lines.push(`- Average: ${summary.avgLatencyMs.toFixed(2)}ms`);
    lines.push(`- P95: ${summary.p95LatencyMs.toFixed(2)}ms`);
    lines.push(`- P99: ${summary.p99LatencyMs.toFixed(2)}ms`);
    lines.push("");

    // Identify bottlenecks
    lines.push("### Bottleneck Analysis");

    const decryptTime = timingRows.find(
      (r) => r.label === "client-broadcast:decrypt",
    );
    const updateSceneTime = timingRows.find(
      (r) => r.label === "updateCollaborator:updateScene",
    );
    const mapCloneTime = timingRows.find(
      (r) => r.label === "updateCollaborator:mapClone",
    );

    if (decryptTime) {
      const avgDecrypt = parseFloat(decryptTime.avgMs);
      if (avgDecrypt > 2) {
        lines.push(
          `- ⚠️ **Decryption is slow** (avg ${avgDecrypt.toFixed(
            2,
          )}ms). Consider unencrypted volatile channel for cursors.`,
        );
      } else {
        lines.push(`- ✅ Decryption is fast (avg ${avgDecrypt.toFixed(2)}ms)`);
      }
    }

    if (updateSceneTime) {
      const avgUpdate = parseFloat(updateSceneTime.avgMs);
      if (avgUpdate > 5) {
        lines.push(
          `- ⚠️ **updateScene is slow** (avg ${avgUpdate.toFixed(
            2,
          )}ms). Consider RAF batching.`,
        );
      } else {
        lines.push(`- ✅ updateScene is fast (avg ${avgUpdate.toFixed(2)}ms)`);
      }
    }

    if (mapCloneTime) {
      const avgClone = parseFloat(mapCloneTime.avgMs);
      if (avgClone > 1) {
        lines.push(
          `- ⚠️ **Map cloning overhead** (avg ${avgClone.toFixed(
            2,
          )}ms). Consider mutable updates.`,
        );
      }
    }

    // Overall assessment
    lines.push("");
    lines.push("### Recommendation");
    if (summary.p95LatencyMs > 50) {
      lines.push(
        "🔴 **High latency detected.** Implement RAF batching for cursor updates.",
      );
    } else if (summary.p95LatencyMs > 20) {
      lines.push(
        "🟡 **Moderate latency.** Consider RAF batching if cursor feels laggy.",
      );
    } else {
      lines.push(
        "🟢 **Good performance.** Current implementation is performing well.",
      );
    }
  } else {
    lines.push(
      "⚠️ No collaboration messages received. Make sure another user is connected and moving their cursor.",
    );
  }

  return lines.join("\n");
}

function generateMarkdownReport(): string {
  const report = generateReport();

  let md = `# AstraDraw Collaboration Profiling Report\n\n`;
  md += `Generated: ${report.generatedAt}\n`;
  md += `Duration: ${report.durationSeconds.toFixed(1)} seconds\n`;
  md += `User Agent: ${report.userAgent}\n\n`;

  md += `${report.analysis}\n\n`;

  md += "### Detailed Timings\n\n";
  md +=
    "| Label | Count | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Min (ms) | Max (ms) |\n";
  md +=
    "|-------|-------|----------|----------|----------|----------|----------|----------|\n";

  for (const row of report.timings) {
    md += `| ${row.label} | ${row.count} | ${row.avgMs} | ${row.p50Ms} | ${row.p95Ms} | ${row.p99Ms} | ${row.minMs} | ${row.maxMs} |\n`;
  }

  return md;
}

// Expose functions globally
if (typeof window !== "undefined") {
  window.COLLAB_PROFILING_STATS = () => {
    const report = generateReport();
    console.group("[Collab Profiling] Aggregated Stats");
    console.log(report.analysis);
    console.table(report.timings);
    console.groupEnd();
  };

  window.COLLAB_PROFILING_EXPORT = () => {
    const report = generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collab-profiling-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log("[Collab Profiling] Report downloaded!");
  };

  window.COLLAB_PROFILING_COPY = async () => {
    const markdown = generateMarkdownReport();
    try {
      await navigator.clipboard.writeText(markdown);
      console.log("[Collab Profiling] Markdown report copied to clipboard!");
      console.log("You can now paste this into a chat with AI for analysis.");
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      console.log(`Here's the report:\n\n${markdown}`);
    }
  };

  window.COLLAB_PROFILING_CLEAR = () => {
    timings.clear();
    rawSamples.length = 0;
    profilingStartTime = null;
    console.log("[Collab Profiling] All data cleared");
  };

  window.COLLAB_PROFILING_RAW = () => {
    return [...rawSamples];
  };
}

export function clearProfilingStats(): void {
  timings.clear();
  rawSamples.length = 0;
  profilingStartTime = null;
  console.log("[Collab Profiling] Stats cleared");
}
