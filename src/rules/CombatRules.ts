import type {
  ActionResult,
  Character,
  DamageRoll,
  DamageType,
  DiceRollResult,
  Item,
  NPC,
  Spell,
  WeaponProperties,
  ArmorProperties,
} from '@/types';
import { abilityModifier } from '@/utils/math';
import { DiceRoller, type RollOptions } from './DiceRoller';

type Combatant = Character | NPC;

function isCharacter(entity: Combatant): entity is Character {
  return entity.type === 'character';
}

function getAbilityScores(entity: Combatant) {
  return isCharacter(entity) ? entity.abilityScores : entity.stats.abilityScores;
}

function getAC(entity: Combatant): number {
  return isCharacter(entity) ? entity.armorClass : entity.stats.armorClass;
}

function getCurrentHp(entity: Combatant): number {
  return isCharacter(entity) ? entity.currentHp : entity.stats.currentHp;
}

function getMaxHp(entity: Combatant): number {
  return isCharacter(entity) ? entity.maxHp : entity.stats.maxHp;
}

function getResistances(entity: Combatant): DamageType[] {
  return isCharacter(entity) ? [] : entity.stats.resistances;
}

function getImmunities(entity: Combatant): DamageType[] {
  return isCharacter(entity) ? [] : entity.stats.immunities;
}

function getVulnerabilities(entity: Combatant): DamageType[] {
  return isCharacter(entity) ? [] : entity.stats.vulnerabilities;
}

function getProficiencyBonus(entity: Combatant): number {
  if (isCharacter(entity)) return entity.proficiencyBonus;
  return Math.floor((entity.stats.level - 1) / 4) + 2;
}

function isWeaponProperties(props: unknown): props is WeaponProperties {
  return typeof props === 'object' && props !== null && 'damage' in props && 'weaponType' in props;
}

function isArmorProperties(props: unknown): props is ArmorProperties {
  return typeof props === 'object' && props !== null && 'baseAC' in props && 'armorType' in props;
}

export class CombatRules {
  constructor(private dice: DiceRoller) {}

  /** Determine the attack bonus for a combatant with an optional weapon. */
  getAttackBonus(attacker: Combatant, weapon?: Item): number {
    const scores = getAbilityScores(attacker);
    const prof = getProficiencyBonus(attacker);

    if (!weapon || !isWeaponProperties(weapon.properties)) {
      // Unarmed strike: Str mod + proficiency
      return abilityModifier(scores.strength) + prof;
    }

    const wp = weapon.properties;
    let abilityMod: number;

    if (wp.range === 'ranged') {
      abilityMod = abilityModifier(scores.dexterity);
    } else if (wp.tags.includes('finesse')) {
      abilityMod = Math.max(abilityModifier(scores.strength), abilityModifier(scores.dexterity));
    } else {
      abilityMod = abilityModifier(scores.strength);
    }

    return abilityMod + prof;
  }

  /** Full attack roll flow: d20 + bonus vs AC, damage on hit. */
  attackRoll(
    attacker: Combatant,
    target: Combatant,
    weapon?: Item,
    options?: RollOptions,
  ): ActionResult {
    const bonus = this.getAttackBonus(attacker, weapon);
    const ac = getAC(target);
    const rollResult = this.dice.rollD20({ ...options, modifier: bonus });
    const hit = rollResult.isCritical || (!rollResult.isFumble && rollResult.total >= ac);

    const rolls: DiceRollResult[] = [rollResult];
    let damage = 0;
    let damageType: DamageType = 'bludgeoning';

    if (hit && weapon && isWeaponProperties(weapon.properties)) {
      const wp = weapon.properties;
      damageType = wp.damage.type;
      const scores = getAbilityScores(attacker);

      let dmgBonus: number;
      if (wp.range === 'ranged') {
        dmgBonus = abilityModifier(scores.dexterity);
      } else if (wp.tags.includes('finesse')) {
        dmgBonus = Math.max(abilityModifier(scores.strength), abilityModifier(scores.dexterity));
      } else {
        dmgBonus = abilityModifier(scores.strength);
      }

      const dmgRoll: DamageRoll = { ...wp.damage, bonus: (wp.damage.bonus ?? 0) + dmgBonus };
      const dmgResult = this.rollDamage(dmgRoll, rollResult.isCritical);
      rolls.push(dmgResult);
      damage = Math.max(0, dmgResult.total);
    } else if (hit) {
      // Unarmed strike: 1 + Str mod
      const strMod = abilityModifier(getAbilityScores(attacker).strength);
      damage = Math.max(0, 1 + strMod);
    }

    const weaponName = weapon?.name ?? 'Unarmed Strike';
    const desc = hit
      ? `${weaponName} hits for ${damage} ${damageType} damage.`
      : `${weaponName} misses (${rollResult.total} vs AC ${ac}).`;

    return {
      success: hit,
      type: 'attack',
      actorId: attacker.id,
      targetId: target.id,
      damage: hit ? damage : undefined,
      damageType: hit ? damageType : undefined,
      description: desc,
      rolls,
    };
  }

  /** Melee attack shorthand. */
  meleeAttack(attacker: Combatant, target: Combatant, weapon: Item): ActionResult {
    return this.attackRoll(attacker, target, weapon);
  }

  /** Ranged attack. Disadvantage at long range. */
  rangedAttack(
    attacker: Combatant,
    target: Combatant,
    weapon: Item,
    distance: number,
  ): ActionResult {
    if (!isWeaponProperties(weapon.properties)) {
      return this.attackRoll(attacker, target, weapon);
    }
    const wp = weapon.properties;
    const longRange = wp.rangeLong ?? wp.rangeNormal ?? 0;
    const normalRange = wp.rangeNormal ?? 0;

    if (distance > longRange) {
      return {
        success: false,
        type: 'attack',
        actorId: attacker.id,
        targetId: target.id,
        description: `Target is out of range (${distance} ft, max ${longRange} ft).`,
        rolls: [],
      };
    }

    const disadvantage = distance > normalRange;
    return this.attackRoll(attacker, target, weapon, { disadvantage });
  }

  /** Spell attack roll (ranged or melee spell attack). */
  spellAttack(attacker: Combatant, target: Combatant, spell: Spell): ActionResult {
    const scores = getAbilityScores(attacker);
    const prof = getProficiencyBonus(attacker);

    let castingAbilityMod: number;
    if (isCharacter(attacker) && attacker.spellcasting) {
      castingAbilityMod = abilityModifier(scores[attacker.spellcasting.ability]);
    } else {
      castingAbilityMod = abilityModifier(scores.intelligence);
    }

    const bonus = castingAbilityMod + prof;
    const ac = getAC(target);
    const rollResult = this.dice.rollD20({ modifier: bonus });
    const hit = rollResult.isCritical || (!rollResult.isFumble && rollResult.total >= ac);

    const rolls: DiceRollResult[] = [rollResult];
    let totalDamage = 0;
    let totalHealing = 0;
    let damageType: DamageType | undefined;

    if (hit) {
      for (const effect of spell.effects) {
        if (effect.damage) {
          const dmgResult = this.rollDamage(effect.damage, rollResult.isCritical);
          rolls.push(dmgResult);
          totalDamage += Math.max(0, dmgResult.total);
          damageType = effect.damage.type;
        }
        if (effect.healing) {
          const healResult = this.dice.rollDamage(effect.healing);
          rolls.push(healResult);
          totalHealing += Math.max(0, healResult.total);
        }
      }
    }

    const desc = hit
      ? `${spell.name} hits for ${totalDamage > 0 ? `${totalDamage} ${damageType} damage` : ''}${totalHealing > 0 ? `${totalHealing} healing` : ''}.`
      : `${spell.name} misses (${rollResult.total} vs AC ${ac}).`;

    return {
      success: hit,
      type: 'cast_spell',
      actorId: attacker.id,
      targetId: target.id,
      damage: totalDamage > 0 ? totalDamage : undefined,
      damageType,
      healing: totalHealing > 0 ? totalHealing : undefined,
      description: desc,
      rolls,
    };
  }

  /** Roll damage dice. On critical, double the number of dice. */
  rollDamage(damage: DamageRoll, critical: boolean): DiceRollResult {
    const effectiveDamage: DamageRoll = critical
      ? { ...damage, count: damage.count * 2 }
      : damage;
    return this.dice.rollDamage(effectiveDamage);
  }

  /** Apply damage to a target, accounting for resistance/immunity/vulnerability. */
  applyDamage(
    target: Combatant,
    damage: number,
    type: DamageType,
  ): { actualDamage: number; unconscious: boolean; dead: boolean } {
    const immunities = getImmunities(target);
    const resistances = getResistances(target);
    const vulnerabilities = getVulnerabilities(target);

    let actualDamage = damage;
    if (immunities.includes(type)) {
      actualDamage = 0;
    } else if (resistances.includes(type)) {
      actualDamage = Math.floor(damage / 2);
    } else if (vulnerabilities.includes(type)) {
      actualDamage = damage * 2;
    }

    // Apply temp HP first for characters
    if (isCharacter(target) && target.tempHp > 0) {
      const absorbed = Math.min(target.tempHp, actualDamage);
      target.tempHp -= absorbed;
      actualDamage -= absorbed;
    }

    const currentHp = getCurrentHp(target);
    const newHp = Math.max(0, currentHp - actualDamage);

    if (isCharacter(target)) {
      target.currentHp = newHp;
    } else {
      target.stats.currentHp = newHp;
    }

    const unconscious = newHp === 0;
    // NPCs die at 0 HP; player characters go unconscious
    const dead = unconscious && !isCharacter(target);

    if (unconscious && isCharacter(target)) {
      const hasUnconscious = target.conditions.some((c) => c.type === 'unconscious');
      if (!hasUnconscious) {
        target.conditions.push({ type: 'unconscious' });
      }
    }

    // Check for massive damage: instant death if remaining damage >= max HP
    if (isCharacter(target) && actualDamage > 0) {
      const overkill = actualDamage - currentHp;
      if (overkill >= getMaxHp(target)) {
        return { actualDamage, unconscious: true, dead: true };
      }
    }

    return { actualDamage, unconscious, dead };
  }

  /** Death saving throw for a player character. */
  deathSavingThrow(character: Character): {
    result: DiceRollResult;
    stable: boolean;
    dead: boolean;
    revived: boolean;
  } {
    const result = this.dice.rollD20();
    let stable = false;
    let dead = false;
    let revived = false;

    if (result.isCritical) {
      // Natural 20: regain 1 HP
      character.currentHp = 1;
      character.deathSaves = { successes: 0, failures: 0 };
      character.conditions = character.conditions.filter((c) => c.type !== 'unconscious');
      revived = true;
    } else if (result.isFumble) {
      // Natural 1: two failures
      character.deathSaves.failures += 2;
    } else if (result.total >= 10) {
      character.deathSaves.successes += 1;
    } else {
      character.deathSaves.failures += 1;
    }

    if (character.deathSaves.successes >= 3) {
      stable = true;
      character.deathSaves = { successes: 0, failures: 0 };
    }

    if (character.deathSaves.failures >= 3) {
      dead = true;
      character.deathSaves = { successes: 0, failures: 0 };
    }

    return { result, stable, dead, revived };
  }

  /** Calculate AC from equipped armor and Dex. */
  calculateAC(character: Character, equipment: Item[]): number {
    let baseAC = 10 + abilityModifier(character.abilityScores.dexterity);
    let shieldBonus = 0;

    for (const item of equipment) {
      if (item.itemType === 'armor' && isArmorProperties(item.properties)) {
        const ap = item.properties;
        if (ap.armorType === 'shield') {
          shieldBonus = ap.baseAC;
        } else {
          const dexMod = abilityModifier(character.abilityScores.dexterity);
          if (ap.armorType === 'heavy') {
            baseAC = ap.baseAC;
          } else if (ap.armorType === 'medium') {
            const cappedDex = Math.min(dexMod, ap.maxDexBonus ?? 2);
            baseAC = ap.baseAC + cappedDex;
          } else {
            // Light armor: full Dex
            baseAC = ap.baseAC + dexMod;
          }
        }
      }
    }

    let totalAC = baseAC + shieldBonus;

    // Fighting Style: Defense — +1 AC while wearing armor
    const hasDefenseStyle = character.features?.some(
      f => f.id === 'feature_fighting_style',
    );
    const hasArmor = equipment.some(
      item => item.itemType === 'armor' && isArmorProperties(item.properties) && item.properties.armorType !== 'shield',
    );
    if (hasDefenseStyle && hasArmor) {
      totalAC += 1;
    }

    return totalAC;
  }
}
