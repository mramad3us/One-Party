import type { GameEngine } from '@/engine/GameEngine';
import type { Ability, AbilityScores, Skill } from '@/types';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { el } from '@/utils/dom';
import { SRD_RACES, type RaceDefinition } from '@/data/races';
import { SRD_CLASSES, type ClassDefinition } from '@/data/classes';
import { SRD_SPELLS } from '@/data/spells';
import { isDevMode } from '@/utils/devmode';

const SCHOOL_LABELS: Record<string, string> = {
  abjuration: 'Abjuration', conjuration: 'Conjuration', divination: 'Divination',
  enchantment: 'Enchantment', evocation: 'Evocation', illusion: 'Illusion',
  necromancy: 'Necromancy', transmutation: 'Transmutation',
};

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
 * Character creation wizard with 5-6 steps:
 * Race -> Class -> Abilities -> Skills -> [Spells] -> Name & Confirm
 * The Spells step only appears for spellcasting classes.
 */
export class CreationScreen extends Component {
  private step = 0;

  // Selections
  private selectedRace: RaceDefinition | null = null;
  private selectedClass: ClassDefinition | null = null;
  private abilityScores: AbilityScores = {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  };
  private selectedSkills: Set<Skill> = new Set();
  private selectedCantrips: Set<string> = new Set();
  private selectedSpells: Set<string> = new Set();
  private characterName = '';
  private pointsRemaining = 27;

  /** Whether current class has spellcasting — determines step count. */
  private get isCaster(): boolean {
    return !!this.selectedClass?.spellcasting;
  }
  private get totalSteps(): number {
    return this.isCaster ? 6 : 5;
  }
  private get stepLabels(): string[] {
    return this.isCaster
      ? ['Race', 'Class', 'Abilities', 'Skills', 'Spells', 'Name']
      : ['Race', 'Class', 'Abilities', 'Skills', 'Name'];
  }

  // Refs
  private contentEl!: HTMLElement;
  private stepsEl!: HTMLElement;
  private focusNav: FocusNav;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
    this.focusNav = new FocusNav({
      columns: 3,
      onSelect: (el) => (el as HTMLElement).click(),
      onCancel: () => this.goBack(),
    });
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

  destroy(): void {
    this.focusNav.detach();
    super.destroy();
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
    switch (this.logicalStep) {
      case 'race': return this.selectedRace !== null;
      case 'class': return this.selectedClass !== null;
      case 'abilities': return true;
      case 'skills': {
        const needed = this.selectedClass?.skillChoices.choose ?? 0;
        return this.selectedSkills.size === needed;
      }
      case 'spells': {
        const maxCantrips = this.getMaxCantrips();
        const maxSpells = this.getMaxPreparedSpells();
        return this.selectedCantrips.size === maxCantrips && this.selectedSpells.size === maxSpells;
      }
      case 'name': return this.characterName.trim().length > 0;
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

  /** Map numeric step to a logical step name, accounting for optional Spells step. */
  private get logicalStep(): 'race' | 'class' | 'abilities' | 'skills' | 'spells' | 'name' {
    if (this.step <= 3) return (['race', 'class', 'abilities', 'skills'] as const)[this.step];
    if (this.isCaster && this.step === 4) return 'spells';
    return 'name';
  }

  private renderStep(): void {
    let panel: HTMLElement;

    switch (this.logicalStep) {
      case 'race': panel = this.renderRaceStep(); break;
      case 'class': panel = this.renderClassStep(); break;
      case 'abilities': panel = this.renderAbilityStep(); break;
      case 'skills': panel = this.renderSkillsStep(); break;
      case 'spells': panel = this.renderSpellsStep(); break;
      case 'name': panel = this.renderNameStep(); break;
      default: panel = el('div'); break;
    }

    panel.classList.add('creation-step-panel');
    this.contentEl.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('active');
      // Set up keyboard focus for the new step's interactive elements
      this.updateFocusItems();
    });

    this.updateNavButtons();
  }

  private updateFocusItems(): void {
    // Detach the previous FocusNav before creating a new one
    this.focusNav.detach();

    let items: HTMLElement[] = [];
    switch (this.logicalStep) {
      case 'race':
        items = Array.from(this.contentEl.querySelectorAll('.creation-option')) as HTMLElement[];
        this.focusNav = new FocusNav({
          columns: 3,
          onSelect: (el) => el.click(),
          onCancel: () => this.goBack(),
        });
        break;
      case 'class':
        items = Array.from(this.contentEl.querySelectorAll('.creation-option')) as HTMLElement[];
        this.focusNav = new FocusNav({
          columns: 3,
          onSelect: (el) => el.click(),
          onCancel: () => this.goBack(),
        });
        break;
      case 'abilities':
        items = Array.from(this.contentEl.querySelectorAll('.ability-score-btn')) as HTMLElement[];
        this.focusNav = new FocusNav({
          columns: 2,
          onSelect: (el) => el.click(),
          onCancel: () => this.goBack(),
        });
        break;
      case 'skills':
        items = Array.from(this.contentEl.querySelectorAll('.skill-option')) as HTMLElement[];
        this.focusNav = new FocusNav({
          columns: 3,
          onSelect: (el) => el.click(),
          onCancel: () => this.goBack(),
        });
        break;
      case 'spells':
        items = Array.from(this.contentEl.querySelectorAll('.spell-pick-option')) as HTMLElement[];
        this.focusNav = new FocusNav({
          columns: 2,
          onSelect: (el) => el.click(),
          onCancel: () => this.goBack(),
        });
        break;
      case 'name':
        this.focusNav = new FocusNav({
          onCancel: () => this.goBack(),
        });
        break;
    }
    this.focusNav.setItems(items);
    this.focusNav.attach();
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

    // Dev mode: quick character cards
    if (isDevMode()) {
      const quickOptions: { label: string; desc: string; filter: 'any' | 'melee' | 'caster' }[] = [
        { label: '\u26A1 Quick Random', desc: 'Fully random class and race.', filter: 'any' },
        { label: '\u2694\uFE0F Quick Melee', desc: 'Random Fighter or Rogue.', filter: 'melee' },
        { label: '\u2728 Quick Caster', desc: 'Random Wizard or Cleric.', filter: 'caster' },
      ];
      for (const opt of quickOptions) {
        const quickCard = el('div', { class: 'creation-option creation-option--dev' });
        quickCard.appendChild(el('div', { class: 'creation-option-name' }, [opt.label]));
        quickCard.appendChild(el('div', { class: 'creation-option-desc' }, [opt.desc]));
        const devBadge = el('div', { class: 'creation-option-detail' });
        devBadge.appendChild(el('span', { class: 'badge' }, ['DEV']));
        quickCard.appendChild(devBadge);
        quickCard.addEventListener('click', () => this.quickCreateCharacter(opt.filter));
        grid.appendChild(quickCard);
      }
    }

    panel.appendChild(grid);
    return panel;
  }

  /** Dev mode: randomize a character and skip to game. */
  private quickCreateCharacter(filter: 'any' | 'melee' | 'caster' = 'any'): void {
    const MELEE_IDS = ['fighter', 'rogue', 'barbarian', 'monk', 'paladin', 'ranger'];
    const CASTER_IDS = ['wizard', 'cleric', 'bard', 'druid', 'sorcerer', 'warlock'];
    const classPool = filter === 'melee'
      ? SRD_CLASSES.filter(c => MELEE_IDS.includes(c.id))
      : filter === 'caster'
        ? SRD_CLASSES.filter(c => CASTER_IDS.includes(c.id))
        : SRD_CLASSES;

    const race = SRD_RACES[Math.floor(Math.random() * SRD_RACES.length)];
    const cls = classPool[Math.floor(Math.random() * classPool.length)];
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

    // Dev mode: know ALL spells for the class
    const className = cls.name.toLowerCase();
    const allCantrips = SRD_SPELLS.filter(s => s.level === 0 && s.classes.includes(className)).map(s => s.id);
    const allSpells = SRD_SPELLS.filter(s => s.level >= 1 && s.classes.includes(className)).map(s => s.id);

    this.engine.events.emit({
      type: 'character:created',
      category: 'character',
      data: {
        name,
        race: race.id,
        class: cls.id,
        abilityScores: scores as AbilityScores,
        skills: chosen,
        selectedCantrips: allCantrips,
        selectedSpells: allSpells,
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
        // Reset skills and spells when class changes
        this.selectedSkills.clear();
        this.selectedCantrips.clear();
        this.selectedSpells.clear();
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

  // ── Spell selection helpers ──

  private getMaxCantrips(): number {
    if (!this.selectedClass?.spellcasting) return 0;
    return this.selectedClass.spellcasting.cantripsKnown[0] ?? 3;
  }

  private getMaxPreparedSpells(): number {
    if (!this.selectedClass?.spellcasting || !this.selectedRace) return 0;
    const sc = this.selectedClass.spellcasting;
    // Known-spells casters use a fixed table
    if (sc.spellsKnown) {
      return sc.spellsKnown[0] ?? 0; // level 1 value
    }
    // Prepared casters use ability mod + level
    const castingAbility = sc.ability;
    const baseScore = this.abilityScores[castingAbility];
    const raceBonus = this.selectedRace.abilityBonuses[castingAbility] ?? 0;
    const mod = abilityModifier(baseScore + raceBonus);
    return Math.max(1, mod + 1); // ability mod + level (level 1)
  }

  private getClassSpells(level: number): typeof SRD_SPELLS {
    const className = this.selectedClass?.name.toLowerCase() ?? '';
    return SRD_SPELLS.filter(s => s.level === level && s.classes.includes(className));
  }

  private renderSpellsStep(): HTMLElement {
    const panel = el('div');
    const maxCantrips = this.getMaxCantrips();
    const maxSpells = this.getMaxPreparedSpells();

    panel.appendChild(el('h3', { class: 'creation-step-title' }, ['Choose Your Spells']));
    panel.appendChild(el('p', { class: 'creation-step-subtitle' }, [
      'Select the arcane or divine magics your character has mastered.',
    ]));

    // ── Cantrips Section ──
    const cantripSpells = this.getClassSpells(0);
    if (cantripSpells.length > 0) {
      const cantripHeader = el('div', { class: 'spell-pick-section-header' });
      cantripHeader.appendChild(el('span', {}, ['Cantrips']));
      const cantripCount = el('span', {
        class: `spell-pick-counter${this.selectedCantrips.size === maxCantrips ? ' full' : ''}`,
      }, [`${this.selectedCantrips.size} / ${maxCantrips}`]);
      cantripHeader.appendChild(cantripCount);
      panel.appendChild(cantripHeader);

      const cantripGrid = el('div', { class: 'spell-pick-grid' });
      for (const spell of cantripSpells) {
        const isSelected = this.selectedCantrips.has(spell.id);
        const atMax = this.selectedCantrips.size >= maxCantrips && !isSelected;
        cantripGrid.appendChild(this.renderSpellPickOption(spell, isSelected, atMax, 'cantrip'));
      }
      panel.appendChild(cantripGrid);
    }

    // ── Leveled Spells Section ──
    // At level 1, only level-1 spells are available
    const leveledSpells = this.getClassSpells(1);
    if (leveledSpells.length > 0) {
      const spellHeader = el('div', { class: 'spell-pick-section-header' });
      spellHeader.appendChild(el('span', {}, ['Level 1 Spells']));
      const spellCount = el('span', {
        class: `spell-pick-counter${this.selectedSpells.size === maxSpells ? ' full' : ''}`,
      }, [`${this.selectedSpells.size} / ${maxSpells}`]);
      spellHeader.appendChild(spellCount);
      panel.appendChild(spellHeader);

      const spellGrid = el('div', { class: 'spell-pick-grid' });
      for (const spell of leveledSpells) {
        const isSelected = this.selectedSpells.has(spell.id);
        const atMax = this.selectedSpells.size >= maxSpells && !isSelected;
        spellGrid.appendChild(this.renderSpellPickOption(spell, isSelected, atMax, 'leveled'));
      }
      panel.appendChild(spellGrid);
    }

    return panel;
  }

  private renderSpellPickOption(
    spell: typeof SRD_SPELLS[number],
    isSelected: boolean,
    atMax: boolean,
    kind: 'cantrip' | 'leveled',
  ): HTMLElement {
    const option = el('div', {
      class: `spell-pick-option${isSelected ? ' selected' : ''}${atMax ? ' disabled' : ''}`,
    });

    const header = el('div', { class: 'spell-pick-option-header' });
    const check = el('div', { class: 'checkbox-box' });
    header.appendChild(check);
    header.appendChild(el('span', { class: 'spell-pick-name' }, [spell.name]));
    header.appendChild(el('span', { class: 'spell-pick-school' }, [
      SCHOOL_LABELS[spell.school] ?? spell.school,
    ]));
    option.appendChild(header);

    // Effect summary line
    const details: string[] = [];
    for (const eff of spell.effects) {
      if (eff.damage) details.push(`${eff.damage.count}d${eff.damage.die} ${eff.damage.type}`);
      if (eff.healing) details.push(`Heal ${eff.healing.count}d${eff.healing.die}`);
      if (eff.condition) details.push(eff.condition);
    }
    if (spell.range > 0) details.push(`${spell.range} ft`);
    else if (spell.range === -1) details.push('Touch');
    else details.push('Self');
    if (spell.duration.type === 'concentration') details.push('Conc.');
    if (spell.ritual) details.push('Ritual');

    option.appendChild(el('div', { class: 'spell-pick-details' }, [details.join(' · ')]));

    option.addEventListener('click', () => {
      const set = kind === 'cantrip' ? this.selectedCantrips : this.selectedSpells;
      const max = kind === 'cantrip' ? this.getMaxCantrips() : this.getMaxPreparedSpells();

      if (isSelected) {
        set.delete(spell.id);
      } else if (set.size < max) {
        set.add(spell.id);
      } else {
        return;
      }
      // Re-render in place
      const oldPanel = this.contentEl.querySelector('.creation-step-panel');
      if (oldPanel) oldPanel.remove();
      const newPanel = this.renderSpellsStep();
      newPanel.classList.add('creation-step-panel', 'active');
      this.contentEl.appendChild(newPanel);
      this.updateNavButtons();
    });

    return option;
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
        selectedCantrips: Array.from(this.selectedCantrips),
        selectedSpells: Array.from(this.selectedSpells),
      },
    });

    this.engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'game', direction: 'left' },
    });
  }
}
