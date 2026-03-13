import type { GameEngine } from '@/engine/GameEngine';
import type { EntityId } from '@/types';
import { Component } from '@/ui/Component';
import { ProgressBar } from '@/ui/widgets/ProgressBar';
import { IconSystem } from '@/ui/IconSystem';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { el } from '@/utils/dom';

export interface PartyMember {
  id: EntityId;
  name: string;
  level: number;
  className: string;
  currentHp: number;
  maxHp: number;
  armorClass: number;
  conditions: string[];
  isPlayer: boolean;
}

/**
 * Party status panel showing player and companions
 * with animated HP bars, AC badges, and condition icons.
 */
export class PartyPanel extends Component {
  private memberEls: Map<EntityId, HTMLElement> = new Map();
  private hpBars: Map<EntityId, ProgressBar> = new Map();
  private listEl!: HTMLElement;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'party-panel panel' });

    // Header
    const header = el('div', { class: 'party-header' });
    const icon = IconSystem.icon('shield');
    header.appendChild(icon);
    header.appendChild(el('span', { class: 'party-header-title font-heading' }, ['Party']));
    wrapper.appendChild(header);

    // Member list
    this.listEl = el('div', { class: 'party-list' });
    wrapper.appendChild(this.listEl);

    return wrapper;
  }

  protected setupEvents(): void {
    TooltipSystem.getInstance().registerContainer(this.el);
  }

  setMembers(members: PartyMember[]): void {
    // Clear existing
    this.listEl.innerHTML = '';
    this.memberEls.clear();
    for (const bar of this.hpBars.values()) {
      bar.destroy();
    }
    this.hpBars.clear();
    this.children = [];

    // Sort: player first, then companions
    const sorted = [...members].sort((a, b) => {
      if (a.isPlayer && !b.isPlayer) return -1;
      if (!a.isPlayer && b.isPlayer) return 1;
      return 0;
    });

    sorted.forEach((member, idx) => {
      const memberEl = this.createMemberElement(member);
      this.memberEls.set(member.id, memberEl);
      this.listEl.appendChild(memberEl);

      // Stagger animation
      memberEl.style.opacity = '0';
      memberEl.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        memberEl.style.transition = 'opacity 0.3s var(--ease-smooth), transform 0.4s var(--ease-out-back)';
        memberEl.style.opacity = '1';
        memberEl.style.transform = 'translateX(0)';
      }, idx * 80);
    });
  }

  updateMember(id: EntityId, changes: Partial<PartyMember>): void {
    const memberEl = this.memberEls.get(id);
    if (!memberEl) return;

    if (changes.currentHp !== undefined) {
      const hpBar = this.hpBars.get(id);
      if (hpBar) {
        hpBar.setValue(changes.currentHp);
      }
    }

    if (changes.armorClass !== undefined) {
      const acEl = memberEl.querySelector('.party-member-ac-value');
      if (acEl) acEl.textContent = String(changes.armorClass);
    }

    if (changes.conditions !== undefined) {
      const condEl = memberEl.querySelector('.party-member-conditions');
      if (condEl) {
        condEl.innerHTML = '';
        for (const cond of changes.conditions) {
          const badge = el('span', {
            class: 'badge badge-red party-condition',
            'data-tooltip': cond,
          }, [cond.slice(0, 3).toUpperCase()]);
          condEl.appendChild(badge);
        }
      }
    }
  }

  private createMemberElement(member: PartyMember): HTMLElement {
    const classes = ['party-member'];
    if (member.isPlayer) classes.push('party-member--player');

    const memberEl = el('div', { class: classes.join(' ') });

    // Top row: name + AC
    const topRow = el('div', { class: 'party-member-top' });

    const nameEl = el('span', {
      class: `party-member-name ${member.isPlayer ? 'party-member-name--player' : ''}`,
    }, [member.name]);
    topRow.appendChild(nameEl);

    const acBadge = el('span', { class: 'party-member-ac badge badge-gold' });
    const shieldIcon = IconSystem.icon('shield');
    shieldIcon.classList.add('icon-sm');
    acBadge.appendChild(shieldIcon);
    acBadge.appendChild(el('span', { class: 'party-member-ac-value' }, [String(member.armorClass)]));
    topRow.appendChild(acBadge);

    memberEl.appendChild(topRow);

    // Info row: level + class
    const infoRow = el('div', { class: 'party-member-info' }, [
      `Lvl ${member.level} ${member.className}`,
    ]);
    memberEl.appendChild(infoRow);

    // HP bar
    const hpContainer = el('div', { class: 'party-member-hp' });
    const hpBar = new ProgressBar(hpContainer, this.engine, {
      value: member.currentHp,
      max: member.maxHp,
      variant: 'hp',
      showLabel: true,
      animated: true,
    });
    this.addChild(hpBar);
    this.hpBars.set(member.id, hpBar);
    memberEl.appendChild(hpContainer);

    // Conditions
    const condContainer = el('div', { class: 'party-member-conditions' });
    for (const cond of member.conditions) {
      const badge = el('span', {
        class: 'badge badge-red party-condition',
        'data-tooltip': cond,
      }, [cond.slice(0, 3).toUpperCase()]);
      condContainer.appendChild(badge);
    }
    memberEl.appendChild(condContainer);

    return memberEl;
  }
}
