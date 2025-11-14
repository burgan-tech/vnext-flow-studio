#!/usr/bin/env node
/**
 * Generate detailed visual diff report between local and runtime graphs
 */

import { buildLocalGraph, getGraphStats, getAllEdges, getNode, getIncomingEdges, getOutgoingEdges } from './packages/graph-core/dist/index.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';
import * as fs from 'fs';
import * as path from 'path';

async function generateDiffReport() {
  console.log('🔍 Generating Visual Diff Report\n');

  const localPath = process.argv[2] || process.cwd();
  const envConfig = {
    id: 'local',
    name: 'Local Development',
    baseUrl: 'http://localhost:4201',
    domain: 'core',
    auth: { type: 'none' }
  };

  try {
    // Build graphs
    console.log('⏳ Building local graph...');
    const localGraph = await buildLocalGraph({
      basePath: localPath,
      computeHashes: true
    });

    console.log('⏳ Fetching runtime graph...');
    const adapter = new AmorphieRuntimeAdapter();
    const runtimeGraph = await adapter.fetchGraph(envConfig, {
      computeHashes: true,
      includeTypes: ['workflow', 'task', 'schema', 'view', 'function', 'extension']
    });

    console.log('✅ Graphs loaded\n');

    // Generate report
    const report = generateReport(localGraph, runtimeGraph, localPath);

    // Write to file
    const outputPath = '/tmp/graph-diff-report.md';
    fs.writeFileSync(outputPath, report);

    console.log(`✅ Report generated: ${outputPath}\n`);
    console.log('═══════════════════════════════════════');
    console.log(report);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function generateReport(localGraph, runtimeGraph, localPath) {
  const localStats = getGraphStats(localGraph);
  const runtimeStats = getGraphStats(runtimeGraph);

  const localIds = new Set(localGraph.nodes.keys());
  const runtimeIds = new Set(runtimeGraph.nodes.keys());

  const onlyLocal = Array.from(localIds).filter(id => !runtimeIds.has(id));
  const onlyRuntime = Array.from(runtimeIds).filter(id => !localIds.has(id));
  const inBoth = Array.from(localIds).filter(id => runtimeIds.has(id));

  // Analyze drifts
  const apiDrifts = [];
  const configDrifts = [];
  const unchanged = [];

  for (const id of inBoth) {
    const localNode = getNode(localGraph, id);
    const runtimeNode = getNode(runtimeGraph, id);

    const apiDrift = localNode.apiHash !== runtimeNode.apiHash;
    const configDrift = localNode.configHash !== runtimeNode.configHash;

    if (apiDrift) {
      apiDrifts.push({ id, localNode, runtimeNode });
    } else if (configDrift) {
      configDrifts.push({ id, localNode, runtimeNode });
    } else {
      unchanged.push(id);
    }
  }

  // Build report
  let report = '';

  // Header
  report += '# 📊 Graph Diff Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Local Path:** ${localPath}\n`;
  report += `**Runtime:** http://localhost:4201\n\n`;

  report += '---\n\n';

  // Executive Summary
  report += '## 📈 Executive Summary\n\n';
  report += '| Metric | Local | Runtime | Delta |\n';
  report += '|--------|-------|---------|-------|\n';
  report += `| **Total Components** | ${localStats.nodeCount} | ${runtimeStats.nodeCount} | ${localStats.nodeCount - runtimeStats.nodeCount > 0 ? '+' : ''}${localStats.nodeCount - runtimeStats.nodeCount} |\n`;
  report += `| **Dependencies** | ${localStats.edgeCount} | ${runtimeStats.edgeCount} | ${localStats.edgeCount - runtimeStats.edgeCount > 0 ? '+' : ''}${localStats.edgeCount - runtimeStats.edgeCount} |\n`;
  report += `| **Workflows** | ${localStats.nodesByType.workflow || 0} | ${runtimeStats.nodesByType.workflow || 0} | ${(localStats.nodesByType.workflow || 0) - (runtimeStats.nodesByType.workflow || 0) > 0 ? '+' : ''}${(localStats.nodesByType.workflow || 0) - (runtimeStats.nodesByType.workflow || 0)} |\n`;
  report += `| **Tasks** | ${localStats.nodesByType.task || 0} | ${runtimeStats.nodesByType.task || 0} | ${(localStats.nodesByType.task || 0) - (runtimeStats.nodesByType.task || 0) > 0 ? '+' : ''}${(localStats.nodesByType.task || 0) - (runtimeStats.nodesByType.task || 0)} |\n`;
  report += `| **Schemas** | ${localStats.nodesByType.schema || 0} | ${runtimeStats.nodesByType.schema || 0} | ${(localStats.nodesByType.schema || 0) - (runtimeStats.nodesByType.schema || 0) > 0 ? '+' : ''}${(localStats.nodesByType.schema || 0) - (runtimeStats.nodesByType.schema || 0)} |\n\n`;

  // Change Summary
  report += '## 🔄 Change Summary\n\n';
  report += '| Category | Count | Status |\n';
  report += '|----------|-------|--------|\n';
  report += `| 🆕 **New Components** (Local Only) | ${onlyLocal.length} | ${onlyLocal.length > 0 ? '⚠️ Needs Deployment' : '✅ None'} |\n`;
  report += `| 🌐 **Runtime Only** | ${onlyRuntime.length} | ${onlyRuntime.length > 0 ? 'ℹ️ Not in workspace' : '✅ None'} |\n`;
  report += `| ⚠️ **API Drift** (Breaking) | ${apiDrifts.length} | ${apiDrifts.length > 0 ? '🔴 Critical' : '✅ None'} |\n`;
  report += `| ℹ️ **Config Drift** (Behavior) | ${configDrifts.length} | ${configDrifts.length > 0 ? '🟡 Review' : '✅ None'} |\n`;
  report += `| ✅ **Unchanged** | ${unchanged.length} | 🟢 Synced |\n\n`;

  report += '---\n\n';

  // New Components (Local Only)
  if (onlyLocal.length > 0) {
    report += '## 🆕 New Components (Need Deployment)\n\n';
    report += `Found **${onlyLocal.length}** components in local workspace that are not deployed to runtime.\n\n`;

    // Group by domain and type
    const byDomainType = {};
    for (const id of onlyLocal) {
      const node = getNode(localGraph, id);
      const key = `${node.ref.domain}/${node.type}`;
      if (!byDomainType[key]) {
        byDomainType[key] = [];
      }
      byDomainType[key].push(node);
    }

    for (const [key, nodes] of Object.entries(byDomainType)) {
      const [domain, type] = key.split('/');
      report += `### ${domain} - ${type}s (${nodes.length})\n\n`;

      for (const node of nodes) {
        const deps = getOutgoingEdges(localGraph, node.id);
        const dependents = getIncomingEdges(localGraph, node.id);

        report += `#### \`${node.ref.key}\`\n\n`;
        report += `- **Version:** ${node.ref.version}\n`;
        report += `- **Label:** ${node.label || 'N/A'}\n`;
        report += `- **File:** ${node.metadata?.filePath?.split('/').pop() || 'N/A'}\n`;
        report += `- **Tags:** ${node.tags?.join(', ') || 'none'}\n`;
        report += `- **Dependencies:** ${deps.length}\n`;
        report += `- **Dependents:** ${dependents.length}`;
        if (dependents.length > 0) {
          report += ' ⚠️ **HIGH IMPACT**';
        }
        report += '\n';

        if (deps.length > 0 && deps.length <= 5) {
          report += `- **Depends on:**\n`;
          for (const dep of deps) {
            const target = getNode(localGraph, dep.to);
            report += `  - ${target?.ref.key || dep.to} (${dep.type})\n`;
          }
        }

        if (node.apiHash) {
          report += `- **API Hash:** \`${node.apiHash.substring(0, 16)}\`\n`;
        }

        report += '\n';
      }
    }

    report += '---\n\n';
  }

  // Runtime Only Components
  if (onlyRuntime.length > 0) {
    report += '## 🌐 Runtime-Only Components\n\n';
    report += `Found **${onlyRuntime.length}** components in runtime that are not in local workspace.\n\n`;

    // Group by domain
    const byDomain = {};
    for (const id of onlyRuntime) {
      const node = getNode(runtimeGraph, id);
      const domain = node.ref.domain;
      if (!byDomain[domain]) {
        byDomain[domain] = [];
      }
      byDomain[domain].push(node);
    }

    for (const [domain, nodes] of Object.entries(byDomain)) {
      report += `### ${domain} (${nodes.length})\n\n`;

      const byType = {};
      for (const node of nodes) {
        if (!byType[node.type]) {
          byType[node.type] = [];
        }
        byType[node.type].push(node.ref.key);
      }

      for (const [type, keys] of Object.entries(byType)) {
        report += `**${type}s:** ${keys.join(', ')}\n\n`;
      }
    }

    report += '---\n\n';
  }

  // API Drift (Breaking Changes)
  if (apiDrifts.length > 0) {
    report += '## ⚠️ API Drift - Breaking Changes\n\n';
    report += `Found **${apiDrifts.length}** component(s) with API changes (potentially breaking).\n\n`;

    for (const { id, localNode, runtimeNode } of apiDrifts) {
      report += `### 🔴 \`${localNode.ref.key}\` (${localNode.type})\n\n`;

      report += '| Property | Local | Runtime |\n';
      report += '|----------|-------|----------|\n';
      report += `| **Version** | ${localNode.ref.version} | ${runtimeNode.ref.version} |\n`;
      report += `| **API Hash** | \`${localNode.apiHash?.substring(0, 16)}...\` | \`${runtimeNode.apiHash?.substring(0, 16)}...\` |\n`;
      report += `| **Config Hash** | \`${localNode.configHash?.substring(0, 16)}...\` | \`${runtimeNode.configHash?.substring(0, 16)}...\` |\n\n`;

      // Impact analysis
      const dependents = getIncomingEdges(localGraph, id);
      if (dependents.length > 0) {
        report += `⚠️ **IMPACT:** ${dependents.length} component(s) depend on this:\n`;
        for (const dep of dependents.slice(0, 5)) {
          const from = getNode(localGraph, dep.from);
          report += `- ${from?.ref.key || dep.from}\n`;
        }
        if (dependents.length > 5) {
          report += `- ... and ${dependents.length - 5} more\n`;
        }
        report += '\n';
      }

      report += '**Recommendation:** Review API changes carefully before deployment.\n\n';
    }

    report += '---\n\n';
  }

  // Config Drift
  if (configDrifts.length > 0) {
    report += '## ℹ️ Config Drift - Behavior Changes\n\n';
    report += `Found **${configDrifts.length}** component(s) with configuration changes.\n\n`;

    for (const { id, localNode, runtimeNode } of configDrifts) {
      report += `### 🟡 \`${localNode.ref.key}\` (${localNode.type})\n\n`;

      report += '| Property | Local | Runtime |\n';
      report += '|----------|-------|----------|\n';
      report += `| **Config Hash** | \`${localNode.configHash?.substring(0, 16)}...\` | \`${runtimeNode.configHash?.substring(0, 16)}...\` |\n\n`;

      report += '**Note:** Configuration change only - API unchanged.\n\n';
    }

    report += '---\n\n';
  }

  // Unchanged Components
  if (unchanged.length > 0) {
    report += '## ✅ Unchanged Components\n\n';
    report += `**${unchanged.length}** component(s) are identical between local and runtime (same hashes).\n\n`;
  }

  // Deployment Plan
  report += '---\n\n';
  report += '## 🚀 Deployment Plan\n\n';

  if (onlyLocal.length === 0 && apiDrifts.length === 0 && configDrifts.length === 0) {
    report += '✅ **No deployment needed** - Local workspace is in sync with runtime.\n\n';
  } else {
    report += '### Action Items\n\n';

    if (apiDrifts.length > 0) {
      report += `1. **⚠️ CRITICAL:** Review ${apiDrifts.length} component(s) with API drift\n`;
      report += '   - These changes may break dependent components\n';
      report += '   - Update dependent components if needed\n';
      report += '   - Run integration tests\n\n';
    }

    if (onlyLocal.length > 0) {
      report += `2. **Deploy ${onlyLocal.length} new component(s)**\n`;

      // Priority order
      const highImpact = [];
      const lowImpact = [];

      for (const id of onlyLocal) {
        const dependents = getIncomingEdges(localGraph, id);
        if (dependents.length > 0) {
          highImpact.push(id);
        } else {
          lowImpact.push(id);
        }
      }

      if (highImpact.length > 0) {
        report += `   - **High Priority:** ${highImpact.length} component(s) with dependents\n`;
      }
      if (lowImpact.length > 0) {
        report += `   - **Normal Priority:** ${lowImpact.length} standalone component(s)\n`;
      }
      report += '\n';
    }

    if (configDrifts.length > 0) {
      report += `3. **Review ${configDrifts.length} configuration change(s)**\n`;
      report += '   - Behavior changes but API compatible\n';
      report += '   - Lower risk than API changes\n\n';
    }

    report += '### Recommended Deployment Order\n\n';
    report += '1. Deploy schemas first (no dependencies)\n';
    report += '2. Deploy tasks and views\n';
    report += '3. Deploy workflows last (depend on others)\n';
    report += '4. Run smoke tests\n';
    report += '5. Monitor for runtime errors\n\n';
  }

  report += '---\n\n';
  report += `*Report generated by Graph Analysis System at ${new Date().toLocaleString()}*\n`;

  return report;
}

generateDiffReport();
