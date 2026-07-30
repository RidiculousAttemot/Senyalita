import type { TranslationPipelinePlugin, GestureAnimationAsset, SentenceType } from "../types";

export class PipelineOrchestrator {
  private plugins: Map<string, TranslationPipelinePlugin> = new Map();
  private initialized = false;

  async registerPlugin(plugin: TranslationPipelinePlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) return;
    await plugin.init();
    this.plugins.set(plugin.name, plugin);
  }

  unregisterPlugin(name: string): void {
    this.plugins.delete(name);
  }

  getPlugin(name: string): TranslationPipelinePlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): TranslationPipelinePlugin[] {
    return Array.from(this.plugins.values());
  }

  getAvailablePlugins(): TranslationPipelinePlugin[] {
    return this.getAllPlugins().filter((p) => p.isAvailable());
  }

  async translateWithPlugin(name: string, text: string, context: { language: string; sentenceType: SentenceType }): Promise<string[] | null> {
    const plugin = this.plugins.get(name);
    if (!plugin?.translate || !plugin.isAvailable()) return null;
    return plugin.translate(text, context);
  }

  async generatePoseWithPlugin(name: string, text: string, language: string): Promise<GestureAnimationAsset | null> {
    const plugin = this.plugins.get(name);
    if (!plugin?.generatePose || !plugin.isAvailable()) return null;
    return plugin.generatePose(text, { language });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  reset(): void {
    this.plugins.clear();
    this.initialized = false;
  }
}
