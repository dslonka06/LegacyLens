const { ipcMain } = require('electron');
const { AiKnowledgeEngine } = require('../engines/ai/knowledge.engine');
const { AiAnalysisEngine } = require('../engines/ai/analysis.engine');
const { SettingsService } = require('../services/settings/settings.service');
const { wrapHandler } = require('./ipc-utils');

const settingsService = new SettingsService();
const knowledgeEngine = new AiKnowledgeEngine(settingsService);
const analysisEngine = new AiAnalysisEngine(settingsService);

function registerAiHandlers() {
  // ai:explain — send a pre-built prompt, get an explanation string back
  ipcMain.handle('ai:explain', wrapHandler(async (_event, prompt) => {
    if (!prompt || typeof prompt !== 'string') throw new Error('prompt is required');
    return knowledgeEngine.explain(prompt);
  }));

  // ai:analyze — send fileName + sourceCode, get AiAnalysisResult back
  ipcMain.handle('ai:analyze', wrapHandler(async (_event, fileName, sourceCode) => {
    if (!fileName || typeof fileName !== 'string') throw new Error('fileName is required');
    if (!sourceCode || typeof sourceCode !== 'string') throw new Error('sourceCode is required');
    return analysisEngine.analyze(fileName, sourceCode);
  }));

  // ai:getProviderUrl — returns the current configured provider URL
  ipcMain.handle('ai:getProviderUrl', wrapHandler(() => {
    return settingsService.get('aiProviderUrl');
  }));

  // ai:setProviderUrl — updates the configured provider URL
  ipcMain.handle('ai:setProviderUrl', wrapHandler((_event, url) => {
    settingsService.set('aiProviderUrl', url || null);
  }));
}

module.exports = { registerAiHandlers };
