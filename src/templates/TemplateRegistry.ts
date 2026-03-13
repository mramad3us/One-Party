import type { Template, TemplateType } from '@/types';
import { ENCOUNTER_TEMPLATES } from './definitions/encounters';
import { EVENT_TEMPLATES } from './definitions/events';
import { NPC_TEMPLATES } from './definitions/npcs';
import { LOOT_TEMPLATES } from './definitions/loot';

export class TemplateRegistry {
  private templates: Map<string, Template> = new Map();

  register(template: Template): void {
    this.templates.set(template.id, template);
  }

  registerAll(templates: Template[]): void {
    for (const template of templates) {
      this.register(template);
    }
  }

  get(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getByType(type: TemplateType): Template[] {
    const result: Template[] = [];
    for (const template of this.templates.values()) {
      if (template.type === type) {
        result.push(template);
      }
    }
    return result;
  }

  query(filters: { type?: TemplateType; tags?: string[]; minWeight?: number }): Template[] {
    const result: Template[] = [];

    for (const template of this.templates.values()) {
      if (filters.type !== undefined && template.type !== filters.type) continue;

      if (filters.minWeight !== undefined && template.weight < filters.minWeight) continue;

      if (filters.tags !== undefined && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every((tag) => template.tags.includes(tag));
        if (!hasAllTags) continue;
      }

      result.push(template);
    }

    return result;
  }

  loadDefaults(): void {
    this.registerAll(ENCOUNTER_TEMPLATES);
    this.registerAll(EVENT_TEMPLATES);
    this.registerAll(NPC_TEMPLATES);
    this.registerAll(LOOT_TEMPLATES);
  }
}
