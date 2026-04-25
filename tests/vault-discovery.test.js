const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseConnectionsMarkdown,
  parseConceptMarkdown,
  buildDiscoveryGraph,
} = require("../utils/vaultDiscovery");

const makeWorkspace = () => fs.mkdtempSync(path.join(os.tmpdir(), "memorypalace-vault-"));

test("parseConnectionsMarkdown extracts cluster names and members", () => {
  const markdown = `# Knowledge Connections

## Cognitive Bias Cluster
- [[anchoring-bias]]
- [[confirmation-bias]]

## Compound Interest Cluster
- [[compound-interest]]
- [[warren-buffett]]
`;

  assert.deepEqual(parseConnectionsMarkdown(markdown), [
    {
      id: "cognitive-bias-cluster",
      title: "Cognitive Bias Cluster",
      members: ["anchoring-bias", "confirmation-bias"],
    },
    {
      id: "compound-interest-cluster",
      title: "Compound Interest Cluster",
      members: ["compound-interest", "warren-buffett"],
    },
  ]);
});

test("parseConceptMarkdown extracts title, summary, and wikilinks", () => {
  const markdown = `---
title: Bayes Theorem
related:
  - "[[confirmation-bias|Confirmation Bias]]"
---

# Bayes Theorem

## The Core Idea

Bayesian thinking treats belief as a probability updated by evidence.

This connects to [[confirmation-bias|Confirmation Bias]] and [[proof-by-contradiction]].
`;

  const parsed = parseConceptMarkdown(markdown, "bayes-theorem");

  assert.equal(parsed.slug, "bayes-theorem");
  assert.equal(parsed.title, "Bayes Theorem");
  assert.match(parsed.summary, /probability updated by evidence/i);
  assert.deepEqual(parsed.links.sort(), ["confirmation-bias", "proof-by-contradiction"]);
});

test("buildDiscoveryGraph creates a curated graph payload from the vault trio", () => {
  const cwd = makeWorkspace();
  const vaultDir = path.join(cwd, "vault");
  const conceptsDir = path.join(vaultDir, "concepts");

  fs.mkdirSync(conceptsDir, { recursive: true });

  fs.writeFileSync(
    path.join(vaultDir, "CONNECTIONS.md"),
    `# Knowledge Connections

## Cognitive Bias Cluster
- [[anchoring-bias]]
- [[confirmation-bias]]
- [[bayes-theorem]]

## Nash Equilibrium Cluster
- [[nash-equilibrium]]
- [[game-theory]]
- [[bayes-theorem]]

## Compound Interest Cluster
- [[compound-interest]]
- [[warren-buffett]]
- [[bayes-theorem]]
`,
  );

  const conceptDocs = {
    "anchoring-bias": `---
title: Anchoring Bias
---

# Anchoring Bias

## The Core Idea

Anchoring bias makes early information overly influential in judgment.

See also [[confirmation-bias]].
`,
    "confirmation-bias": `---
title: Confirmation Bias
---

# Confirmation Bias

## The Core Idea

People overweight evidence that supports their priors.

Related to [[anchoring-bias]] and [[bayes-theorem]].
`,
    "bayes-theorem": `---
title: Bayes Theorem
---

# Bayes Theorem

## The Core Idea

Beliefs should update as evidence arrives.

Connects to [[confirmation-bias]], [[nash-equilibrium]], and [[compound-interest]].
`,
    "nash-equilibrium": `---
title: Nash Equilibrium
---

# Nash Equilibrium

## The Core Idea

Stable strategy sets are those no player wants to abandon alone.

See [[game-theory]] and [[bayes-theorem]].
`,
    "game-theory": `---
title: Game Theory
---

# Game Theory

## The Core Idea

Strategic interaction depends on incentives and coordination.

See [[nash-equilibrium]].
`,
    "compound-interest": `---
title: Compound Interest
---

# Compound Interest

## The Core Idea

Returns on returns create nonlinear growth over time.

See [[warren-buffett]] and [[bayes-theorem]].
`,
    "warren-buffett": `---
title: Warren Buffett
---

# Warren Buffett

## The Core Idea

Buffett is a durable example of patient compounding.

See [[compound-interest]].
`,
  };

  for (const [slug, markdown] of Object.entries(conceptDocs)) {
    fs.writeFileSync(path.join(conceptsDir, `${slug}.md`), markdown);
  }

  const payload = buildDiscoveryGraph({
    vaultRoot: vaultDir,
    selectedClusters: [
      "Cognitive Bias Cluster",
      "Nash Equilibrium Cluster",
      "Compound Interest Cluster",
    ],
  });

  assert.deepEqual(payload.defaultClusterIds, [
    "cognitive-bias-cluster",
    "nash-equilibrium-cluster",
    "compound-interest-cluster",
  ]);
  assert.equal(payload.clusters.length, 3);
  assert.ok(payload.nodes.some((node) => node.id === "bayes-theorem"));
  assert.ok(
    payload.edges.some(
      (edge) =>
        (edge.source === "bayes-theorem" && edge.target === "confirmation-bias") ||
        (edge.source === "confirmation-bias" && edge.target === "bayes-theorem"),
    ),
  );
  assert.ok(payload.clusters.every((cluster) => cluster.nodes.length >= 3));
});
