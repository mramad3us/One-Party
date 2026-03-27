import type { GameEngine } from '@/engine/GameEngine';
import type { Character, Ability, Skill } from '@/types';
import { Component } from '@/ui/Component';
import { ProgressBar } from '@/ui/widgets/ProgressBar';
import { Modal } from '@/ui/widgets/Modal';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { el } from '@/utils/dom';
import { formatModifier, capitalize } from '@/utils/format';
import { getSpell } from '@/data/spells';
import { CLASS_BONUS_ACTIONS } from '@/data/bonusActions';

const ABILITIES: Ability[] = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
];

const ABILITY_ABBR: Record<Ability, string> = {
  strength: 'STR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
};

const ALL_SKILLS: Skill[] = [
  'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception',
  'history', 'insight', 'intimidation', 'investigation', 'medicine',
  'nature', 'perception', 'performance', 'persuasion', 'religion',
  'sleight_of_hand', 'stealth', 'survival',
];

const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dexterity', animal_handling: 'wisdom', arcana: 'intelligence',
  athletics: 'strength', deception: 'charisma', history: 'intelligence',
  insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence',
  medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence',
  sleight_of_hand: 'dexterity', stealth: 'dexterity', survival: 'wisdom',
};

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Character sheet overlay modal.
 * Full D&D character sheet with ability scores, skills, HP,
 * features, proficiencies, and spellcasting.
 */
export class CharacterScreen extends Component {
  private hpBar: ProgressBar | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const backdrop = el('div', { class: 'character-screen modal-backdrop' });
    const dialog = el('div', { class: 'character-dialog' });

    // Header
    const header = el('div', { class: 'character-header' });
    header.appendChild(el('h2', { class: 'character-title font-heading' }, ['Character Sheet']));
    const closeBtn = el('button', { class: 'modal-close btn btn-ghost', 'aria-label': 'Close' }, ['\u00D7']);
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Body (will be populated by setCharacter)
    dialog.appendChild(el('div', { class: 'character-body' }));

    backdrop.appendChild(dialog);
    return backdrop;
  }

  protected setupEvents(): void {
    TooltipSystem.getInstance().registerContainer(this.el);

    this.listen(this.el, 'click', (e: Event) => {
      if (e.target === this.el) this.close();
    });
    // Escape is handled by KeyboardInput → input:cancel → main.ts navigation
  }

  setCharacter(character: Character): void {
    const body = this.$('.character-body');
    if (!body) return;
    body.innerHTML = '';

    // ── Identity Section ──
    const identity = el('div', { class: 'char-identity' });
    identity.appendChild(el('h2', { class: 'char-name font-heading' }, [character.name]));
    identity.appendChild(el('div', { class: 'char-race-class' }, [
      `Level ${character.level} ${capitalize(character.race)} ${capitalize(character.class)}`,
    ]));
    identity.appendChild(el('div', { class: 'char-xp font-mono' }, [
      `XP: ${character.xp}`,
    ]));
    body.appendChild(identity);

    // ── Core Stats Row (AC, Initiative, Speed) ──
    const coreStats = el('div', { class: 'char-core-stats' });

    const acStat = el('div', { class: 'char-stat-block' });
    acStat.appendChild(el('div', { class: 'stat-value' }, [String(character.armorClass)]));
    acStat.appendChild(el('div', { class: 'stat-label' }, ['Armor Class']));
    coreStats.appendChild(acStat);

    const initMod = abilityMod(character.abilityScores.dexterity);
    const initStat = el('div', { class: 'char-stat-block' });
    initStat.appendChild(el('div', { class: 'stat-value' }, [formatModifier(initMod)]));
    initStat.appendChild(el('div', { class: 'stat-label' }, ['Initiative']));
    coreStats.appendChild(initStat);

    const speedStat = el('div', { class: 'char-stat-block' });
    speedStat.appendChild(el('div', { class: 'stat-value' }, [`${character.speed}`]));
    speedStat.appendChild(el('div', { class: 'stat-label' }, ['Speed']));
    coreStats.appendChild(speedStat);

    const profStat = el('div', { class: 'char-stat-block' });
    profStat.appendChild(el('div', { class: 'stat-value' }, [formatModifier(character.proficiencyBonus)]));
    profStat.appendChild(el('div', { class: 'stat-label' }, ['Proficiency']));
    coreStats.appendChild(profStat);

    body.appendChild(coreStats);

    // ── HP Section ──
    const hpSection = el('div', { class: 'char-hp-section' });
    hpSection.appendChild(el('div', { class: 'char-hp-title' }, ['Hit Points']));

    const hpBarWrap = el('div', { class: 'char-hp-bar' });
    this.hpBar = new ProgressBar(hpBarWrap, this.engine, {
      value: character.currentHp,
      max: character.maxHp,
      variant: 'hp',
      showLabel: true,
      animated: true,
    });
    this.addChild(this.hpBar);
    hpSection.appendChild(hpBarWrap);

    if (character.tempHp > 0) {
      hpSection.appendChild(el('div', { class: 'char-temp-hp font-mono' }, [
        `Temp HP: ${character.tempHp}`,
      ]));
    }

    // Hit dice
    hpSection.appendChild(el('div', { class: 'char-hit-dice font-mono' }, [
      `Hit Dice: ${character.hitDice.current}/${character.hitDice.max}d${character.hitDice.die}`,
    ]));

    body.appendChild(hpSection);

    // ── Ability Scores ──
    const abilitySection = el('div', { class: 'char-abilities' });
    for (const ability of ABILITIES) {
      const score = character.abilityScores[ability];
      const mod = abilityMod(score);
      const isSavingProf = character.proficiencies.savingThrows.includes(ability);
      const saveMod = mod + (isSavingProf ? character.proficiencyBonus : 0);

      const abilityTooltip = `${capitalize(ability)}\nScore: ${score} | Modifier: ${formatModifier(mod)}\nSaving Throw: ${formatModifier(saveMod)}${isSavingProf ? ' (proficient)' : ''}`;
      const card = el('div', { class: 'char-ability-card', 'data-tooltip': abilityTooltip });
      card.appendChild(el('div', { class: 'char-ability-label' }, [ABILITY_ABBR[ability]]));
      card.appendChild(el('div', { class: 'char-ability-score stat-value' }, [String(score)]));
      card.appendChild(el('div', { class: 'char-ability-mod stat-modifier' }, [formatModifier(mod)]));

      const saveEl = el('div', {
        class: `char-ability-save ${isSavingProf ? 'char-ability-save--prof' : ''}`,
      }, [`Save ${formatModifier(saveMod)}`]);
      card.appendChild(saveEl);

      abilitySection.appendChild(card);
    }
    body.appendChild(abilitySection);

    // ── Skills ──
    const skillsSection = el('div', { class: 'char-skills' });
    skillsSection.appendChild(el('h3', { class: 'char-section-title font-heading' }, ['Skills']));

    const skillsList = el('div', { class: 'char-skills-list' });
    for (const skill of ALL_SKILLS) {
      const ability = SKILL_ABILITY[skill];
      const mod = abilityMod(character.abilityScores[ability]);
      const isProf = character.proficiencies.skills.includes(skill);
      const totalMod = mod + (isProf ? character.proficiencyBonus : 0);
      const skillName = skill.replace(/_/g, ' ');

      const skillTooltip = `${capitalize(skillName)}\n${ABILITY_ABBR[ability]} ${formatModifier(totalMod)}${isProf ? ' (proficient)' : ''}`;
      const skillRow = el('div', { class: 'char-skill-row', 'data-tooltip': skillTooltip });

      const profDot = el('span', {
        class: `char-skill-prof ${isProf ? 'char-skill-prof--active' : ''}`,
      });
      skillRow.appendChild(profDot);
      skillRow.appendChild(el('span', { class: 'char-skill-name' }, [capitalize(skillName)]));
      skillRow.appendChild(el('span', { class: 'char-skill-mod font-mono' }, [formatModifier(totalMod)]));

      skillsList.appendChild(skillRow);
    }
    skillsSection.appendChild(skillsList);
    body.appendChild(skillsSection);

    // ── Features & Traits ──
    if (character.features.length > 0) {
      const featSection = el('div', { class: 'char-features' });
      featSection.appendChild(el('h3', { class: 'char-section-title font-heading' }, ['Features & Traits']));

      for (const feat of character.features) {
        const featTooltip = `${feat.name}\nSource: ${feat.source}${feat.usesMax !== undefined ? `\nUses: ${feat.usesRemaining ?? 0}/${feat.usesMax}` : ''}`;
        const featEl = el('div', { class: 'char-feature', 'data-tooltip': featTooltip });
        const nameRow = el('div', { class: 'char-feature-name' }, [feat.name]);
        // Tag features that are bonus actions
        const isBonusAction = CLASS_BONUS_ACTIONS.some(ba => ba.featureId === feat.id);
        if (isBonusAction) {
          nameRow.appendChild(el('span', { class: 'char-feature-tag char-feature-tag--bonus' }, ['Bonus Action']));
        }
        featEl.appendChild(nameRow);
        featEl.appendChild(el('div', { class: 'char-feature-desc' }, [feat.description]));
        if (feat.usesMax !== undefined) {
          featEl.appendChild(el('div', { class: 'char-feature-uses font-mono' }, [
            `Uses: ${feat.usesRemaining ?? 0}/${feat.usesMax}`,
          ]));
        }
        featSection.appendChild(featEl);
      }
      body.appendChild(featSection);
    }

    // ── Proficiencies ──
    const profSection = el('div', { class: 'char-proficiencies' });
    profSection.appendChild(el('h3', { class: 'char-section-title font-heading' }, ['Proficiencies']));

    const profGroups: [string, string[]][] = [
      ['Armor', character.proficiencies.armor],
      ['Weapons', character.proficiencies.weapons],
      ['Tools', character.proficiencies.tools],
      ['Languages', character.proficiencies.languages],
    ];

    for (const [label, items] of profGroups) {
      if (items.length === 0) continue;
      const row = el('div', { class: 'char-prof-row' });
      row.appendChild(el('span', { class: 'char-prof-label' }, [`${label}: `]));
      row.appendChild(el('span', { class: 'char-prof-list' }, [items.join(', ')]));
      profSection.appendChild(row);
    }
    body.appendChild(profSection);

    // ── Spellcasting ──
    if (character.spellcasting) {
      const spellSection = el('div', { class: 'char-spellcasting' });
      spellSection.appendChild(el('h3', { class: 'char-section-title font-heading' }, ['Spellcasting']));

      const sc = character.spellcasting;
      const spellMod = abilityMod(character.abilityScores[sc.ability]) + character.proficiencyBonus;
      const spellDC = 8 + spellMod;

      const spellInfo = el('div', { class: 'char-spell-info' });
      spellInfo.appendChild(el('span', {}, [
        `Ability: ${ABILITY_ABBR[sc.ability]} | Attack: ${formatModifier(spellMod)} | DC: ${spellDC}`,
      ]));
      spellSection.appendChild(spellInfo);

      // Spell slots
      const slotsRow = el('div', { class: 'char-spell-slots' });
      for (const [levelStr, slot] of Object.entries(sc.spellSlots)) {
        const level = parseInt(levelStr, 10);
        if (slot.max === 0) continue;
        const slotEl = el('div', { class: 'char-spell-slot' });
        slotEl.appendChild(el('div', { class: 'char-spell-slot-level' }, [`Lvl ${level}`]));
        slotEl.appendChild(el('div', { class: 'char-spell-slot-count font-mono' }, [
          `${slot.current}/${slot.max}`,
        ]));
        slotsRow.appendChild(slotEl);
      }
      spellSection.appendChild(slotsRow);

      // Known/Prepared spells (show names, not IDs)
      if (sc.cantripsKnown.length > 0) {
        spellSection.appendChild(el('div', { class: 'char-spell-list-label' }, ['Cantrips']));
        const cantripNames = sc.cantripsKnown.map(id => getSpell(id)?.name ?? id).join(', ');
        spellSection.appendChild(el('div', { class: 'char-spell-list' }, [cantripNames]));
      }
      if (sc.preparedSpells.length > 0) {
        const maxPrepared = abilityMod(character.abilityScores[sc.ability]) + character.level;
        spellSection.appendChild(el('div', { class: 'char-spell-list-label' }, [
          `Prepared Spells (${sc.preparedSpells.length}/${Math.max(1, maxPrepared)})`,
        ]));
        const spellNames = sc.preparedSpells.map(id => getSpell(id)?.name ?? id).join(', ');
        spellSection.appendChild(el('div', { class: 'char-spell-list' }, [spellNames]));
      }

      // Prepare Spells button
      const prepBtn = el('button', { class: 'btn btn-secondary btn-sm' }, ['Prepare Spells']);
      prepBtn.style.marginTop = '0.5rem';
      prepBtn.addEventListener('click', () => this.openSpellPrepModal(character));
      spellSection.appendChild(prepBtn);

      body.appendChild(spellSection);
    }
  }

  private openSpellPrepModal(character: Character): void {
    const sc = character.spellcasting;
    if (!sc) return;

    const maxPrepared = Math.max(1, abilityMod(character.abilityScores[sc.ability]) + character.level);
    const prepared = new Set(sc.preparedSpells);

    const content = el('div', { class: 'spell-prep-content' });

    // Counter display
    const counter = el('div', { class: 'spell-prep-counter font-mono' });
    const updateCounter = () => {
      counter.textContent = `Prepared: ${prepared.size} / ${maxPrepared}`;
      counter.style.color = prepared.size > maxPrepared ? '#c04040' : '#b0a080';
    };
    updateCounter();
    content.appendChild(counter);

    // Group spells by level
    const spellsByLevel = new Map<number, { id: string; name: string; school: string; description: string }[]>();
    for (const spellId of sc.knownSpells) {
      const spell = getSpell(spellId);
      if (!spell) continue;
      const level = spell.level;
      if (!spellsByLevel.has(level)) spellsByLevel.set(level, []);
      spellsByLevel.get(level)!.push({
        id: spellId,
        name: spell.name,
        school: spell.school,
        description: this.spellSummary(spell),
      });
    }

    // Sort by level
    const sortedLevels = Array.from(spellsByLevel.keys()).sort((a, b) => a - b);

    for (const level of sortedLevels) {
      const spells = spellsByLevel.get(level)!;
      const slot = sc.spellSlots[level];
      const slotInfo = slot ? ` (${slot.current}/${slot.max} slots)` : '';

      const levelHeader = el('div', { class: 'spell-prep-level-header font-heading' }, [
        `Level ${level}${slotInfo}`,
      ]);
      content.appendChild(levelHeader);

      for (const spell of spells) {
        const row = el('div', { class: 'spell-prep-row' });
        if (prepared.has(spell.id)) row.classList.add('spell-prep-row--active');

        const checkbox = el('div', { class: 'spell-prep-check font-mono' });
        checkbox.textContent = prepared.has(spell.id) ? '\u25C6' : '\u25C7';

        const info = el('div', { class: 'spell-prep-info' });
        info.appendChild(el('div', { class: 'spell-prep-name' }, [spell.name]));
        info.appendChild(el('div', { class: 'spell-prep-desc' }, [
          `${capitalize(spell.school)} \u2022 ${spell.description}`,
        ]));

        row.appendChild(checkbox);
        row.appendChild(info);

        row.addEventListener('click', () => {
          if (prepared.has(spell.id)) {
            prepared.delete(spell.id);
            row.classList.remove('spell-prep-row--active');
            checkbox.textContent = '\u25C7';
          } else {
            if (prepared.size >= maxPrepared) return; // at capacity
            prepared.add(spell.id);
            row.classList.add('spell-prep-row--active');
            checkbox.textContent = '\u25C6';
          }
          updateCounter();
        });

        content.appendChild(row);
      }
    }

    // Cantrips (always prepared, shown for reference)
    if (sc.cantripsKnown.length > 0) {
      const cantripHeader = el('div', { class: 'spell-prep-level-header font-heading' }, [
        'Cantrips (always prepared)',
      ]);
      content.appendChild(cantripHeader);
      for (const cantripId of sc.cantripsKnown) {
        const spell = getSpell(cantripId);
        if (!spell) continue;
        const row = el('div', { class: 'spell-prep-row spell-prep-row--cantrip' });
        const checkbox = el('div', { class: 'spell-prep-check font-mono' }, ['\u25C6']);
        const info = el('div', { class: 'spell-prep-info' });
        info.appendChild(el('div', { class: 'spell-prep-name' }, [spell.name]));
        info.appendChild(el('div', { class: 'spell-prep-desc' }, [
          `${capitalize(spell.school)} \u2022 ${this.spellSummary(spell)}`,
        ]));
        row.appendChild(checkbox);
        row.appendChild(info);
        content.appendChild(row);
      }
    }

    const modal = new Modal(document.body, this.engine, {
      title: 'Prepare Spells',
      content,
      closable: true,
      width: '420px',
      actions: [
        {
          label: 'Confirm',
          variant: 'primary',
          onClick: () => {
            // Apply prepared spells to character
            character.spellcasting!.preparedSpells = Array.from(prepared);
            modal.close();
            // Refresh character sheet
            this.setCharacter(character);
          },
        },
      ],
    });
    modal.mount();
  }

  private spellSummary(spell: ReturnType<typeof getSpell>): string {
    if (!spell) return '';
    const parts: string[] = [];
    for (const eff of spell.effects) {
      if (eff.damage) parts.push(`${eff.damage.count}d${eff.damage.die} ${eff.damage.type}`);
      if (eff.healing) parts.push(`${eff.healing.count}d${eff.healing.die} healing`);
    }
    const range = spell.range > 0 ? `${spell.range}ft` : spell.range === 0 ? 'self' : 'touch';
    parts.push(range);
    if (spell.duration.type === 'concentration') parts.push('conc.');
    return parts.join(' \u2022 ');
  }

  async close(): Promise<void> {
    this.engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'game', direction: 'down' },
    });
  }
}
