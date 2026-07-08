class WorkflowExplorerEngine {

  // Returns summaries for workflows that include a specific node by name or id.
  // Delegates to buildSummaries() on the filtered flow subset — no new analysis logic.
  summariesForNode(nodeId, flows) {
    const relevant = flows.filter(flow =>
      flow.nodes.some(n => n.id === nodeId || n.name === nodeId)
    );
    return this.buildSummaries(relevant);
  }

  // Converts raw DataFlow objects into human-readable WorkflowSummary objects.
  buildSummaries(flows) {
    return flows.map(flow => this.buildSummary(flow));
  }

  buildSummary(flow) {
    const path = flow.nodes.map(n => n.name);

    const steps = this.generateSteps(flow);
    const category = this.inferCategory(flow);

    return {
      title: this.humanizeTitle(flow.name),
      description: flow.description,
      steps,
      flowPath: path,
      confidence: flow.confidence,
      category,
    };
  }

  generateSteps(flow) {
    const steps = [];
    const nodes = flow.nodes;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const next = nodes[i + 1];

      switch (node.type) {
        case 'entry':
          steps.push(`The request is received by ${node.name}.`);
          break;
        case 'processor':
          if (i === 0) {
            steps.push(`${node.name} begins processing the request.`);
          } else {
            steps.push(`${node.name} applies business logic${next ? ` and passes results to ${next.name}` : ''}.`);
          }
          break;
        case 'repository':
          steps.push(`${node.name} handles data access${next?.type === 'database' ? ` against the database` : ''}.`);
          break;
        case 'database':
          steps.push(`Data is persisted or retrieved from the database.`);
          break;
        case 'external':
          steps.push(`${node.name} communicates with an external system.`);
          break;
        default:
          steps.push(`${node.name} participates in the workflow.`);
      }
    }

    return steps;
  }

  inferCategory(flow) {
    const types = flow.nodes.map(n => n.type);
    if (types.includes('entry') && types.includes('processor') && types.includes('repository')) {
      return 'request-handling';
    }
    if (types.includes('processor') && types.includes('repository')) {
      return 'data-access';
    }
    if (types.includes('processor') && types.includes('external')) {
      return 'generic';
    }
    if (types.includes('entry') && types.includes('processor')) {
      return 'component-service';
    }
    return 'generic';
  }

  humanizeTitle(name) {
    // "FundingController Workflow" → "Funding Request Processing"
    return name
      .replace(/Controller\s+Workflow/i, ' Request Processing')
      .replace(/Service\s+Workflow/i, ' Service Flow')
      .replace(/Handler\s+Workflow/i, ' Event Handling')
      .replace(/Page\s+Workflow/i, ' Page Flow')
      .replace(/Component\s+Workflow/i, ' Component Flow')
      .trim();
  }
}

module.exports = { WorkflowExplorerEngine };
