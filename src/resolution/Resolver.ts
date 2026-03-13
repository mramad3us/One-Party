import type {
  ResolvedEvent,
  Template,
  TemplateCondition,
  TemplateType,
  TemplateVariable,
} from '@/types';
import { TemplateRegistry } from '@/templates/TemplateRegistry';
import { SeededRNG } from '@/utils/SeededRNG';

export class Resolver {
  constructor(
    private registry: TemplateRegistry,
    private rng: SeededRNG,
  ) {}

  resolve(template: Template, state: Record<string, unknown>): ResolvedEvent {
    const resolvedData: Record<string, unknown> = { ...template.data };

    // Resolve all variables
    for (const variable of template.variables) {
      const value = this.resolveVariable(variable, state);
      resolvedData[variable.name] = value;
    }

    return {
      templateId: template.id,
      type: template.type,
      timestamp: { totalRounds: (state['totalRounds'] as number) ?? 0 },
      resolvedData,
      narrativeHints: (template.data['narrativeHints'] as Array<{ key: string; tone: string; context: Record<string, string> }>) ?? [],
    };
  }

  findEligibleTemplates(
    type: TemplateType,
    state: Record<string, unknown>,
  ): Template[] {
    const candidates = this.registry.getByType(type);
    return candidates.filter((t) => this.meetsConditions(t.conditions, state));
  }

  resolveVariable(
    variable: TemplateVariable,
    state: Record<string, unknown>,
  ): unknown {
    switch (variable.source) {
      case 'state': {
        if (!variable.path) return undefined;
        return this.getNestedValue(state, variable.path);
      }
      case 'random': {
        if (!variable.options || variable.options.length === 0) return undefined;
        return this.rng.pick(variable.options);
      }
      case 'computed': {
        if (!variable.compute) return undefined;
        return this.evaluateCompute(variable.compute, state);
      }
      default:
        return undefined;
    }
  }

  private meetsConditions(
    conditions: TemplateCondition[],
    state: Record<string, unknown>,
  ): boolean {
    for (const condition of conditions) {
      const stateValue = state[condition.type];
      if (stateValue === undefined) continue; // Skip conditions for missing state

      if (!this.evaluateCondition(stateValue, condition.operator, condition.value)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(
    actual: unknown,
    operator: string,
    expected: unknown,
  ): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'neq':
        return actual !== expected;
      case 'gt':
        return (actual as number) > (expected as number);
      case 'lt':
        return (actual as number) < (expected as number);
      case 'gte':
        return (actual as number) >= (expected as number);
      case 'lte':
        return (actual as number) <= (expected as number);
      case 'contains':
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        if (typeof actual === 'string') {
          return actual.includes(expected as string);
        }
        return false;
      case 'not_contains':
        if (Array.isArray(actual)) {
          return !actual.includes(expected);
        }
        if (typeof actual === 'string') {
          return !actual.includes(expected as string);
        }
        return true;
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private evaluateCompute(
    expression: string,
    state: Record<string, unknown>,
  ): unknown {
    // Simple expression evaluator for things like "partySize + 1"
    // Replace known state variables with their values
    let expr = expression;
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'number') {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
      }
    }

    // Evaluate simple math expressions safely
    try {
      // Only allow numbers, operators, and Math functions
      const sanitized = expr.replace(/[^0-9+\-*/().,%\s]/g, '');
      if (sanitized.length === 0) return 0;
      // Use Function constructor for simple math (no user input in production)
      const result = new Function(`return (${sanitized})`)() as number;
      return typeof result === 'number' && !isNaN(result) ? Math.floor(result) : 0;
    } catch {
      return 0;
    }
  }
}
