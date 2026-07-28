/**
 * DataFlowPatternEngine — classifies the overall flow pattern of a file
 * and produces a single overview sentence for the Data Flow page header.
 *
 * Input shape:
 *   {
 *     steps:    string[],
 *     inputs:   string[],
 *     outputs:  string[],
 *     language: string,
 *     fileType: string,
 *   }
 *
 * Output:
 *   {
 *     label:    string,   // e.g. 'Request Handling', 'Data Transformation'
 *     overview: string,   // one sentence describing the overall flow
 *   }
 */

const PATTERN_RULES = [
  {
    label: 'Request Handling',
    keywords: ['request', 'response', 'http', 'endpoint', 'route', 'handler', 'controller', 'incoming', 'receive'],
    overview: (d) => `This file implements a ${d.steps.length}-step request handling flow, receiving ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'external input'} and producing ${d.outputs.length > 0 ? d.outputs.slice(0, 2).join(' and ') : 'a response'}.`,
  },
  {
    label: 'Data Transformation',
    keywords: ['transform', 'convert', 'map', 'parse', 'format', 'serialize', 'normaliz', 'encode', 'decode', 'adapt'],
    overview: (d) => `This file transforms data through ${d.steps.length} step${d.steps.length !== 1 ? 's' : ''}, converting ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'input data'} into ${d.outputs.length > 0 ? d.outputs.slice(0, 2).join(' and ') : 'a new form'}.`,
  },
  {
    label: 'Validation Pipeline',
    keywords: ['valid', 'sanitiz', 'check', 'verify', 'enforce', 'constrain', 'schema', 'guard'],
    overview: (d) => `This file runs ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'incoming data'} through a ${d.steps.length}-step validation pipeline before passing it downstream.`,
  },
  {
    label: 'Data Persistence',
    keywords: ['save', 'store', 'persist', 'query', 'fetch', 'load', 'read', 'write', 'insert', 'update', 'delete', 'database', 'repository'],
    overview: (d) => `This file manages data persistence across ${d.steps.length} step${d.steps.length !== 1 ? 's' : ''}, handling ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'data operations'} and returning ${d.outputs.length > 0 ? d.outputs[0] : 'results'}.`,
  },
  {
    label: 'Authentication Flow',
    keywords: ['auth', 'login', 'logout', 'token', 'credential', 'session', 'jwt', 'oauth', 'signin', 'signout'],
    overview: (d) => `This file implements an authentication flow across ${d.steps.length} step${d.steps.length !== 1 ? 's' : ''}, verifying ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'credentials'} and producing ${d.outputs.length > 0 ? d.outputs[0] : 'an auth result'}.`,
  },
  {
    label: 'Event Processing',
    keywords: ['event', 'emit', 'dispatch', 'publish', 'subscribe', 'listen', 'notify', 'observe', 'broadcast', 'trigger'],
    overview: (d) => `This file processes events through ${d.steps.length} step${d.steps.length !== 1 ? 's' : ''}, consuming ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'incoming events'} and emitting ${d.outputs.length > 0 ? d.outputs.slice(0, 2).join(' and ') : 'downstream signals'}.`,
  },
  {
    label: 'Computation Pipeline',
    keywords: ['calculat', 'comput', 'deriv', 'aggregat', 'sum', 'average', 'score', 'rank', 'formula', 'algorithm', 'process'],
    overview: (d) => `This file performs computation across ${d.steps.length} step${d.steps.length !== 1 ? 's' : ''}, taking ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'raw inputs'} and producing ${d.outputs.length > 0 ? d.outputs.slice(0, 2).join(' and ') : 'derived results'}.`,
  },
  {
    label: 'State Management',
    keywords: ['state', 'store', 'cache', 'maintain', 'track', 'update state', 'dispatch action', 'reducer', 'selector'],
    overview: (d) => `This file manages state transitions across ${d.steps.length} step${d.steps.length !== 1 ? 's' : ''}, receiving ${d.inputs.length > 0 ? d.inputs.slice(0, 2).join(' and ') : 'state updates'} and producing ${d.outputs.length > 0 ? d.outputs[0] : 'a new state'}.`,
  },
];

class DataFlowPatternEngine {

  build(data) {
    const { steps = [], inputs = [], outputs = [], language = 'Unknown', fileType = 'file' } = data;
    const allText = [...steps, ...inputs, ...outputs].join(' ').toLowerCase();

    for (const rule of PATTERN_RULES) {
      if (rule.keywords.some(kw => allText.includes(kw))) {
        return {
          label: rule.label,
          overview: rule.overview({ steps, inputs, outputs, language, fileType }),
        };
      }
    }

    // Fallback: generic based on step count
    const stepCount = steps.length;
    const overview = stepCount > 0
      ? `This file processes data through ${stepCount} step${stepCount !== 1 ? 's' : ''}${inputs.length > 0 ? ', taking ' + inputs.slice(0, 2).join(' and ') + ' as input' : ''}${outputs.length > 0 ? ' and producing ' + outputs.slice(0, 2).join(' and ') : ''}.`
      : `This file handles data flow between its inputs and outputs.`;

    return { label: 'Data Processing', overview };
  }
}

module.exports = { DataFlowPatternEngine };
