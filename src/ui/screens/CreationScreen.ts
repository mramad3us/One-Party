import type { GameEngine } from '@/engine/GameEngine';
import type { Ability, AbilityScores, Skill } from '@/types';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';
import { SRD_RACES, type RaceDefinition } from '@/data/races';
import { SRD_CLASSES, type ClassDefinition } from '@/data/classes';
import { isDevMode } from '@/utils/devmode';

const QUICK_NAMES = [
  'Aldric', 'Brunda', 'Cael', 'Dara', 'Elowen', 'Falk', 'Gideon',
  'Hestia', 'Ivo', 'Jorin', 'Kael', 'Lyria', 'Maren', 'Nyx',
  'Orin', 'Pip', 'Quillen', 'Rook', 'Sable', 'Theron', 'Vex', 'Wren',
];

const ABILITIES: Ability[] = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
];

const ABILITY_ABBR: Record<Ability, string> = {
  strength: 'STR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
};

const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dexterity', animal_handling: 'wisdom', arcana: 'intelligence',
  athletics: 'strength', deception: 'charisma', history: 'intelligence',
  insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence',
  medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence',
  sleight_of_hand: 'dexterity', stealth: 'dexterity', survival: 'wisdom',
};

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatSkillName(skill: string): string {
  return skill
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Character creation wizard with 5 steps:
 * Race -> Class -> Ability Scores -> Skills -> Name & Confirm
 */
export class CreationScreen extends Component {
  private step = 0;
  private totalSteps = 5;
  private stepLabels = ['Race', 'Class', 'Abilities', 'Skills', 'Name'];

  // Selections
  private selectedRace: RaceDefinition | null = null;
  private selectedClass: ClassDefinition | null = null;
  private abilityScores: AbilityScores = {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  };
  private selectedSkills: Set<Skill> = new Set();
  private characterName = '';
  private pointsRemaining = 27;

  // Refs
  private contentEl!: HTMLElement;
  private stepsEl!: HTMLElement;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'creation-screen screen' });

    // Header
    const header = el('div', { class: 'creation-header' });
    const title = el('h2', { class: 'creation-header-title' }, ['Create Your Hero']);
    header.appendChild(title);
    screen.appendChild(header);

    // Step indicator
    this.stepsEl = el('div', { class: 'creation-steps' });
    this.renderStepIndicator();
    screen.appendChild(this.stepsEl);

    // Content area
    this.contentEl = el('div', { class: 'creation-content' });
    screen.appendChild(this.contentEl);

    // Navigation
    const nav = el('div', { class: 'creation-nav' });

    const backBtn = el('button', {
      class: 'btn btn-secondary',
      'data-nav': 'back',
    }, ['Back']);

    const nextBtn = el('button', {
      class: 'btn btn-primary',
      'data-nav': 'next',
    }, ['Next']);

    nav.appendChild(backBtn);
    nav.appendChild(el('div', { class: 'creation-nav-spacer' }));
    nav.appendChild(nextBtn);
    screen.appendChild(nav);

    return screen;
  }

  mount(): void {
    super.mount();
    this.renderStep();
  }

  protected setupEvents(): void {
    const backBtn = this.el.querySelector('[data-nav="back"]');
    const nextBtn = this.el.querySelector('[data-nav="next"]');

    if (backBtn) {
      this.listen(backBtn, 'click', () => this.goBack());
    }
    if (nextBtn) {
      this.listen(nextBtn, 'click', () => this.goNext());
    }
  }

  private goBack(): void {
    if (this.step === 0) {
      this.engine.events.emit({
        type: 'ui:navigate',
        category: 'ui',
        data: { screen: 'menu', direction: 'right' },
      });
      return;
    }
    this.step--;
    this.transitionStep('right');
  }

  private goNext(): void {
    if (!this.validateStep()) return;

    if (this.step === this.totalSteps - 1) {
      this.finishCreation();
      return;
    }
    this.step++;
    this.transitionStep('left');
  }

  private validateStep(): boolean {
    switch (this.step) {
      case 0: return this.selectedRace !== null;
      case 1: return this.selectedClass !== null;
      case 2: return true; // Scores always valid
      case 3: {
        const needed = this.selectedClass?.skillChoices.choose ?? 0;
        return this.selectedSkills.size === needed;
      }
      case 4: return this.characterName.trim().length > 0;
      default: return true;
    }
  }

  private transitionStep(direction: 'left' | 'right'): void {
    const oldPanel = this.contentEl.querySelector('.creation-step-panel');
    if (oldPanel) {
      const exitClass = direction === 'left' ? 'exit-left' : 'exit-right';
      oldPanel.classList.add(exitClass);
      oldPanel.classList.remove('active');
      setTimeout(() => oldPanel.remove(), 300);
    }

    setTimeout(() => {
      this.renderStep();
      this.renderStepIndicator();
      this.updateNavButtons();
    }, 150);
  }

  private renderStep(): void {
    let panel: HTMLElement;

    switch (this.step) {
      case 0: panel = this.renderRaceStep(); break;
      case 1: panel = this.renderClassStep(); break;
      case 2: panel = this.renderAbilityStep(); break;
      case 3: panel = this.renderSkillsStep(); break;
      case 4: panel = this.renderNameStep(); break;
      default: panel = el('div'); break;
    }

    panel.classList.add('creation-step-panel');
    this.contentEl.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('active');
    });

    this.updateNavButtons();
  }

  private renderStepIndicator(): void {
    this.stepsEl.innerHTML = '';
    for (let i = 0; i < this.totalSteps; i++) {
      if (i > 0) {
        const conn = el('div', { class: 'creation-step-connector' });
        if (i <= this.step) conn.classList.add('completed');
        this.stepsEl.appendChild(conn);
      }
      const group = el('div', { class: 'creation-step-group' });
      const dot = el('div', { class: 'creation-step-dot' });
      if (i === this.step) dot.classList.add('active');
      else if (i < this.step) dot.classList.add('completed');
      group.appendChild(dot);

      const label = el('span', { class: 'creation-step-label' }, [this.stepLabels[i]]);
      if (i === this.step) label.classList.add('active');
      group.appendChild(label);

      this.stepsEl.appendChild(group);
    }
  }

  private updateNavButtons(): void {
    const backBtn = this.el.querySelector('[data-nav="back"]') as HTMLButtonElement | null;
    const nextBtn = this.el.querySelector('[data-nav="next"]') as HTMLButtonElement | null;

    if (backBtn) {
      backBtn.textContent = this.step === 0 ? 'Menu' : 'Back';
    }
    if (nextBtn) {
      if (this.step === this.totalSteps - 1) {
        nextBtn.textContent = 'Begin Adventure';
        nextBtn.className = 'btn btn-primary btn-lg';
      } else {
        nextBtn.textContent = 'Next';
        nextBtn.className = 'btn btn-primary';
      }
    }
  }

  // ── Step Renderers ──

  private renderRaceStep(): HTMLElement {
    const panel = el('div');
    panel.appendChild(el('h3', { class: 'creation-step-title' }, ['Choose Your Race']));
    panel.appendChild(el('p', { class: 'creation-step-subtitle' }, [
      'Your race determines your physical traits, abilities, and heritage.',
    ]));

    const grid = el('div', { class: 'creation-grid' });

    for (const race of SRD_RACES) {
      const option = el('div', {
        class: 'creation-option',
        'data-race': race.id,
      });
      if (this.selectedRace?.id === race.id) {
        option.classList.add('selected');
      }

      option.appendChild(el('div', { class: 'creation-option-name' }, [race.name]));
      option.appendChild(el('div', { class: 'creation-option-desc' }, [
        race.description.slice(0, 120) + (race.description.length > 120 ? '...' : ''),
      ]));

      const detail = el('div', { class: 'creation-option-detail' });
      const bonuses = Object.entries(race.abilityBonuses)
        .map(([a, v]) => `${ABILITY_ABBR[a as Ability]} +${v}`)
        .join(', ');
      detail.appendChild(el('span', { class: 'badge badge-gold' }, [bonuses]));
      detail.appendChild(el('span', { class: 'badge' }, [`Speed ${race.speed}`]));
      option.appendChild(detail);

      option.addEventListener('click', () => {
        this.selectedRace = race;
        this.el.querySelectorAll('[data-race]').forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');
      });

      grid.appendChild(option);
    }

    // Dev mode: "Quick Character" card
    if (isDevMode()) {
      const quickCard = el('div', { class: 'creation-option creation-option--dev' });
      quickCard.appendChild(el('div', { class: 'creation-option-name' }, ['\u26A1 Quick Character']));
      quickCard.appendChild(el('div', { class: 'creation-option-desc' }, [
        'Randomize everything and jump straight into the game. (Dev mode)',
      ]));
      const devBadge = el('div', { class: 'creation-option-detail' });
      devBadge.appendChild(el('span', { class: 'badge' }, ['DEV']));
      quickCard.appendChild(devBadge);

      quickCard.addEventListener('click', () => this.quickCreateCharacter());
      grid.appendChild(quickCard);
    }

    panel.appendChild(grid);
    return panel;
  }

  /** Dev mode: randomize a character and skip to game. */
  private quickCreateCharacter(): void {
    const race = SRD_RACES[Math.floor(Math.random() * SRD_RACES.length)];
    const cls = SRD_CLASSES[Math.floor(Math.random() * SRD_CLASSES.length)];
    const name = QUICK_NAMES[Math.floor(Math.random() * QUICK_NAMES.length)];

    // Roll 4d6-drop-lowest for each ability
    const scores: Partial<AbilityScores> = {};
    for (const ability of ABILITIES) {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => a - b);
      scores[ability] = rolls[1] + rolls[2] + rolls[3];
    }

    // Pick random skills from class options
    const available = [...cls.skillChoices.from];
    const chosen: Skill[] = [];
    const needed = cls.skillChoices.choose;
    for (let i = 0; i < needed && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      chosen.push(available.splice(idx, 1)[0]);
    }

    this.engine.events.emit({
      type: 'character:created',
      category: 'character',
      data: {
        name,
        race: race.id,
        class: cls.id,
        abilityScores: scores as AbilityScores,
        skills: chosen,
      },
    });

    this.engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'game', direction: 'left' },
    });
  }

  private renderClassStep(): HTMLElement {
    const panel = el('div');
    panel.appendChild(el('h3', { class: 'creation-step-title' }, ['Choose Your Class']));
    panel.appendChild(el('p', { class: 'creation-step-subtitle' }, [
      'Your class defines your combat abilities, skills, and role in the world.',
    ]));

    const grid = el('div', { class: 'creation-grid' });

    for (const cls of SRD_CLASSES) {
      const option = el('div', {
        class: 'creation-option',
        'data-class': cls.id,
      });
      if (this.selectedClass?.id === cls.id) {
        option.classList.add('selected');
      }

      option.appendChild(el('div', { class: 'creation-option-name' }, [cls.name]));
      option.appendChild(el('div', { class: 'creation-option-desc' }, [
        cls.description.slice(0, 120) + (cls.description.length > 120 ? '...' : ''),
      ]));

      const detail = el('div', { class: 'creation-option-detail' });
      detail.appendChild(el('span', { class: 'badge badge-gold' }, [`d${cls.hitDie} Hit Die`]));
      detail.appendChild(el('span', { class: 'badge' }, [
        `Primary: ${ABILITY_ABBR[cls.primaryAbility]}`,
      ]));
      if (cls.spellcasting) {
        detail.appendChild(el('span', { class: 'badge badge-purple' }, ['Spellcaster']));
      }
      option.appendChild(detail);

      option.addEventListener('click', () => {
        this.selectedClass = cls;
        // Reset skills when class changes
        this.selectedSkills.clear();
        this.el.querySelectorAll('[data-class]').forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');
      });

      grid.appendChild(option);
    }

    panel.appendChild(grid);
    return panel;
  }

  private renderAbilityStep(): HTMLElement {
    const panel = el('div');
    panel.appendChild(el('h3', { class: 'creation-step-title' }, ['Ability Scores']));
    panel.appendChild(el('p', { class: 'creation-step-subtitle' }, [
      'Allocate your ability scores. Roll for random values or use point buy.',
    ]));

    // Points remaining indicator
    const pointsDisplay = el('div', { class: 'skills-remaining' }, [
      'Points remaining: ',
    ]);
    const pointsCount = el('span', {
      class: 'skills-remaining-count',
      'data-points': '',
    }, [`${this.pointsRemaining}`]);
    pointsDisplay.appendChild(pointsCount);
    panel.appendChild(pointsDisplay);

    // Roll button
    const rollBtn = el('button', {
      class: 'btn btn-secondary roll-stats-btn',
    }, ['Roll Stats (4d6 drop lowest)']);
    rollBtn.addEventListener('click', () => {
      this.rollStats();
      this.refreshAbilityDisplay();
    });
    panel.appendChild(rollBtn);

    // Ability scores grid
    const grid = el('div', { class: 'ability-scores-grid', 'data-abilities': '' });
    this.renderAbilityCards(grid);
    panel.appendChild(grid);

    return panel;
  }

  private renderAbilityCards(grid: HTMLElement): void {
    grid.innerHTML = '';
    for (const ability of ABILITIES) {
      const score = this.abilityScores[ability];
      const raceBonus = this.selectedRace?.abilityBonuses[ability] ?? 0;
      const totalScore = score + raceBonus;
      const totalMod = abilityModifier(totalScore);

      const card = el('div', { class: 'ability-score-card' });
      card.appendChild(el('div', { class: 'ability-score-name' }, [ABILITY_ABBR[ability]]));
      card.appendChild(el('div', { class: 'ability-score-value' }, [`${totalScore}`]));
      card.appendChild(el('div', { class: 'ability-score-modifier' }, [
        formatModifier(totalMod) + (raceBonus ? ` (${score}+${raceBonus})` : ''),
      ]));

      const controls = el('div', { class: 'ability-score-controls' });

      const minusBtn = el('button', { class: 'ability-score-btn' }, ['\u2212']);
      if (score <= 8) minusBtn.setAttribute('disabled', '');
      minusBtn.addEventListener('click', () => {
        if (this.abilityScores[ability] > 8) {
          const cost = this.getPointCost(this.abilityScores[ability]) ?? 0;
          this.abilityScores[ability]--;
          this.pointsRemaining += cost;
          this.refreshAbilityDisplay();
        }
      });

      const plusBtn = el('button', { class: 'ability-score-btn' }, ['+']);
      const nextCost = this.getPointCost(score + 1);
      if (score >= 15 || (nextCost !== null && this.pointsRemaining < nextCost)) {
        plusBtn.setAttribute('disabled', '');
      }
      plusBtn.addEventListener('click', () => {
        const cost = this.getPointCost(this.abilityScores[ability] + 1);
        if (this.abilityScores[ability] < 15 && cost !== null && this.pointsRemaining >= cost) {
          this.abilityScores[ability]++;
          this.pointsRemaining -= cost;
          this.refreshAbilityDisplay();
        }
      });

      controls.appendChild(minusBtn);
      controls.appendChild(plusBtn);
      card.appendChild(controls);
      grid.appendChild(card);
    }
  }

  private refreshAbilityDisplay(): void {
    const grid = this.el.querySelector('[data-abilities]') as HTMLElement | null;
    if (grid) this.renderAbilityCards(grid);

    const pointsEl = this.el.querySelector('[data-points]');
    if (pointsEl) pointsEl.textContent = `${this.pointsRemaining}`;
  }

  private getPointCost(score: number): number | null {
    // Point buy costs: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9
    const costs: Record<number, number> = {
      8: 0, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 2, 15: 2,
    };
    return costs[score] ?? null;
  }

  private rollStats(): void {
    for (const ability of ABILITIES) {
      // Roll 4d6, drop lowest
      const rolls: number[] = [];
      for (let i = 0; i < 4; i++) {
        rolls.push(Math.floor(Math.random() * 6) + 1);
      }
      rolls.sort((a, b) => a - b);
      this.abilityScores[ability] = rolls[1] + rolls[2] + rolls[3];
    }
    // Disable point buy counter when rolled
    this.pointsRemaining = 0;
  }

  private renderSkillsStep(): HTMLElement {
    const panel = el('div');
    const cls = this.selectedClass;
    const maxChoices = cls?.skillChoices.choose ?? 2;
    const available = cls?.skillChoices.from ?? [];

    panel.appendChild(el('h3', { class: 'creation-step-title' }, ['Choose Skills']));
    panel.appendChild(el('p', { class: 'creation-step-subtitle' }, [
      `Select ${maxChoices} skill${maxChoices > 1 ? 's' : ''} from your class list.`,
    ]));

    const counter = el('div', { class: 'skills-remaining' }, [
      'Remaining: ',
    ]);
    const countSpan = el('span', { class: 'skills-remaining-count' }, [
      `${maxChoices - this.selectedSkills.size}`,
    ]);
    counter.appendChild(countSpan);
    panel.appendChild(counter);

    const grid = el('div', { class: 'skills-grid' });

    for (const skill of available) {
      const isSelected = this.selectedSkills.has(skill);
      const atMax = this.selectedSkills.size >= maxChoices && !isSelected;

      const option = el('div', {
        class: `skill-option${isSelected ? ' selected' : ''}${atMax ? ' disabled' : ''}`,
        'data-skill': skill,
      });

      const box = el('div', { class: 'checkbox-box' });
      const nameEl = el('span', { class: 'skill-option-name' }, [formatSkillName(skill)]);
      const abilityEl = el('span', { class: 'skill-option-ability' }, [
        ABILITY_ABBR[SKILL_ABILITY[skill]],
      ]);

      option.appendChild(box);
      option.appendChild(nameEl);
      option.appendChild(abilityEl);

      option.addEventListener('click', () => {
        if (isSelected) {
          this.selectedSkills.delete(skill);
        } else if (this.selectedSkills.size < maxChoices) {
          this.selectedSkills.add(skill);
        } else {
          return;
        }
        // Re-render skills in place
        const oldPanel = this.contentEl.querySelector('.creation-step-panel');
        if (oldPanel) oldPanel.remove();
        const newPanel = this.renderSkillsStep();
        newPanel.classList.add('creation-step-panel', 'active');
        this.contentEl.appendChild(newPanel);
        this.updateNavButtons();
      });

      grid.appendChild(option);
    }

    panel.appendChild(grid);
    return panel;
  }

  private renderNameStep(): HTMLElement {
    const panel = el('div');
    panel.appendChild(el('h3', { class: 'creation-step-title' }, ['Name Your Hero']));
    panel.appendChild(el('p', { class: 'creation-step-subtitle' }, [
      'Give your character a name worthy of legend.',
    ]));

    // Name input
    const wrapper = el('div', { class: 'name-input-wrapper' });
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.placeholder = 'Enter a name...';
    input.value = this.characterName;
    input.maxLength = 30;
    input.addEventListener('input', () => {
      this.characterName = input.value;
    });
    wrapper.appendChild(input);
    panel.appendChild(wrapper);

    // Auto-focus
    requestAnimationFrame(() => input.focus());

    // Character Summary Card
    panel.appendChild(this.renderSummary());

    return panel;
  }

  private renderSummary(): HTMLElement {
    const race = this.selectedRace;
    const cls = this.selectedClass;
    if (!race || !cls) return el('div');

    const summary = el('div', { class: 'character-summary' });

    // Name & subtitle
    summary.appendChild(el('div', { class: 'character-summary-name' }, [
      this.characterName || 'Unnamed Hero',
    ]));
    summary.appendChild(el('div', { class: 'character-summary-subtitle' }, [
      `Level 1 ${race.name} ${cls.name}`,
    ]));

    summary.appendChild(el('hr', { class: 'divider' }));

    // Stats row: HP, AC, Speed
    const conMod = abilityModifier(
      this.abilityScores.constitution + (race.abilityBonuses.constitution ?? 0),
    );
    const hp = cls.hitDie + conMod;
    const dexMod = abilityModifier(
      this.abilityScores.dexterity + (race.abilityBonuses.dexterity ?? 0),
    );
    const ac = 10 + dexMod;

    const statsRow = el('div', { class: 'character-summary-stats' });

    const hpStat = el('div', { class: 'character-summary-stat' });
    hpStat.appendChild(el('div', { class: 'stat-value' }, [`${hp}`]));
    hpStat.appendChild(el('div', { class: 'stat-label' }, ['Hit Points']));
    statsRow.appendChild(hpStat);

    const acStat = el('div', { class: 'character-summary-stat' });
    acStat.appendChild(el('div', { class: 'stat-value' }, [`${ac}`]));
    acStat.appendChild(el('div', { class: 'stat-label' }, ['Armor Class']));
    statsRow.appendChild(acStat);

    const speedStat = el('div', { class: 'character-summary-stat' });
    speedStat.appendChild(el('div', { class: 'stat-value' }, [`${race.speed}`]));
    speedStat.appendChild(el('div', { class: 'stat-label' }, ['Speed']));
    statsRow.appendChild(speedStat);

    summary.appendChild(statsRow);

    // Ability scores
    const abilitiesRow = el('div', { class: 'character-summary-abilities' });
    for (const ability of ABILITIES) {
      const total = this.abilityScores[ability] + (race.abilityBonuses[ability] ?? 0);
      const mod = abilityModifier(total);

      const abilityEl = el('div', { class: 'summary-ability' });
      abilityEl.appendChild(el('div', { class: 'summary-ability-label' }, [ABILITY_ABBR[ability]]));
      abilityEl.appendChild(el('div', { class: 'summary-ability-value' }, [`${total}`]));
      abilityEl.appendChild(el('div', { class: 'summary-ability-mod' }, [formatModifier(mod)]));
      abilitiesRow.appendChild(abilityEl);
    }
    summary.appendChild(abilitiesRow);

    // Skills
    if (this.selectedSkills.size > 0) {
      summary.appendChild(el('div', { class: 'stat-label', style: 'margin-bottom: 8px' }, ['Proficient Skills']));
      const skillsRow = el('div', { class: 'character-summary-skills' });
      for (const skill of this.selectedSkills) {
        skillsRow.appendChild(el('span', { class: 'badge badge-gold' }, [formatSkillName(skill)]));
      }
      summary.appendChild(skillsRow);
    }

    return summary;
  }

  private finishCreation(): void {
    if (!this.selectedRace || !this.selectedClass || !this.characterName.trim()) {
      return;
    }

    this.engine.events.emit({
      type: 'character:created',
      category: 'character',
      data: {
        name: this.characterName.trim(),
        race: this.selectedRace.id,
        class: this.selectedClass.id,
        abilityScores: { ...this.abilityScores },
        skills: Array.from(this.selectedSkills),
      },
    });

    this.engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'game', direction: 'left' },
    });
  }
}
