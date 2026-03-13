import type { GameEngine } from '@/engine/GameEngine';
import type { CreatureStatBlock, Ability } from '@/types';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';
import { formatModifier } from '@/utils/format';

const ABILITY_ABBR: Record<Ability, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const ABILITIES: Ability[] = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
];

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Traditional D&D stat block display for monsters/NPCs.
 * Classic Monster Manual styling with red dividers.
 */
export class StatBlock extends Component {
  private stats: CreatureStatBlock;
  private name: string;

  constructor(parent: HTMLElement, engine: GameEngine, stats: CreatureStatBlock, name: string) {
    super(parent, engine);
    this.stats = stats;
    this.name = name;
  }

  protected createElement(): HTMLElement {
    const { stats, name } = this;
    const block = el('div', { class: 'stat-block' });

    // Name header
    block.appendChild(el('div', { class: 'stat-block-name font-heading' }, [name]));

    // Size line
    block.appendChild(el('div', { class: 'stat-block-meta' }, [
      `${stats.size.charAt(0).toUpperCase() + stats.size.slice(1)} creature`,
    ]));

    // Red divider
    block.appendChild(el('hr', { class: 'stat-block-divider' }));

    // AC, HP, Speed
    const acLine = el('div', { class: 'stat-block-prop' });
    acLine.appendChild(el('span', { class: 'stat-block-prop-label' }, ['Armor Class ']));
    acLine.appendChild(el('span', {}, [String(stats.armorClass)]));
    block.appendChild(acLine);

    const hpLine = el('div', { class: 'stat-block-prop' });
    hpLine.appendChild(el('span', { class: 'stat-block-prop-label' }, ['Hit Points ']));
    hpLine.appendChild(el('span', {}, [`${stats.currentHp}/${stats.maxHp}`]));
    block.appendChild(hpLine);

    const speedLine = el('div', { class: 'stat-block-prop' });
    speedLine.appendChild(el('span', { class: 'stat-block-prop-label' }, ['Speed ']));
    speedLine.appendChild(el('span', {}, [`${stats.speed} ft.`]));
    block.appendChild(speedLine);

    // Red divider
    block.appendChild(el('hr', { class: 'stat-block-divider' }));

    // Ability scores row
    const abilityRow = el('div', { class: 'stat-block-abilities' });
    for (const ability of ABILITIES) {
      const score = stats.abilityScores[ability];
      const mod = abilityMod(score);
      const col = el('div', { class: 'stat-block-ability' });
      col.appendChild(el('div', { class: 'stat-block-ability-label' }, [ABILITY_ABBR[ability]]));
      col.appendChild(el('div', { class: 'stat-block-ability-score' }, [
        `${score} (${formatModifier(mod)})`,
      ]));
      abilityRow.appendChild(col);
    }
    block.appendChild(abilityRow);

    // Red divider
    block.appendChild(el('hr', { class: 'stat-block-divider' }));

    // Resistances/Immunities
    if (stats.resistances.length > 0) {
      const line = el('div', { class: 'stat-block-prop' });
      line.appendChild(el('span', { class: 'stat-block-prop-label' }, ['Damage Resistances ']));
      line.appendChild(el('span', {}, [stats.resistances.join(', ')]));
      block.appendChild(line);
    }

    if (stats.immunities.length > 0) {
      const line = el('div', { class: 'stat-block-prop' });
      line.appendChild(el('span', { class: 'stat-block-prop-label' }, ['Damage Immunities ']));
      line.appendChild(el('span', {}, [stats.immunities.join(', ')]));
      block.appendChild(line);
    }

    if (stats.conditionImmunities.length > 0) {
      const line = el('div', { class: 'stat-block-prop' });
      line.appendChild(el('span', { class: 'stat-block-prop-label' }, ['Condition Immunities ']));
      line.appendChild(el('span', {}, [stats.conditionImmunities.join(', ')]));
      block.appendChild(line);
    }

    // Features
    if (stats.features.length > 0) {
      block.appendChild(el('hr', { class: 'stat-block-divider' }));
      for (const feat of stats.features) {
        const featEl = el('div', { class: 'stat-block-feature' });
        featEl.appendChild(el('span', { class: 'stat-block-feature-name' }, [`${feat.name}. `]));
        featEl.appendChild(el('span', {}, [feat.description]));
        block.appendChild(featEl);
      }
    }

    // Attacks
    if (stats.attacks.length > 0) {
      block.appendChild(el('hr', { class: 'stat-block-divider' }));
      block.appendChild(el('div', { class: 'stat-block-section-title' }, ['Actions']));

      for (const atk of stats.attacks) {
        const atkEl = el('div', { class: 'stat-block-attack' });
        atkEl.appendChild(el('span', { class: 'stat-block-attack-name' }, [`${atk.name}. `]));

        const toHitStr = formatModifier(atk.toHitBonus);
        const damageStr = `${atk.damage.count}d${atk.damage.die}${atk.damage.bonus ? formatModifier(atk.damage.bonus) : ''} ${atk.damage.type}`;
        const reachStr = atk.rangeNormal ? `range ${atk.rangeNormal}/${atk.rangeLong ?? atk.rangeNormal} ft.` : `reach ${atk.reach} ft.`;

        atkEl.appendChild(el('span', {}, [
          `${toHitStr} to hit, ${reachStr}, ${damageStr} damage`,
        ]));
        block.appendChild(atkEl);
      }
    }

    return block;
  }
}
