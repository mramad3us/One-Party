import type { Character } from '@/types';
import { abilityModifier } from '@/utils/math';
import { DiceRoller } from './DiceRoller';

export class RestRules {
  constructor(private dice: DiceRoller) {}

  /**
   * Short rest: spend hit dice to heal.
   * Each hit die spent heals 1dX + Constitution modifier.
   */
  shortRest(
    character: Character,
    hitDiceToSpend: number,
  ): { hpHealed: number; hitDiceUsed: number; featuresRecharged: string[] } {
    const conMod = abilityModifier(character.abilityScores.constitution);
    const actualDice = Math.min(hitDiceToSpend, character.hitDice.current);
    let totalHealed = 0;

    for (let i = 0; i < actualDice; i++) {
      const roll = this.dice.roll(character.hitDice.die);
      const healed = Math.max(0, roll + conMod);
      totalHealed += healed;
    }

    character.hitDice.current -= actualDice;
    character.currentHp = Math.min(character.maxHp, character.currentHp + totalHealed);

    // Recharge short rest features
    const recharged: string[] = [];
    for (const feature of character.features) {
      if (feature.rechargeOn === 'shortRest' && feature.usesMax !== undefined) {
        feature.usesRemaining = feature.usesMax;
        recharged.push(feature.name);
      }
    }

    return { hpHealed: totalHealed, hitDiceUsed: actualDice, featuresRecharged: recharged };
  }

  /**
   * Long rest: full HP, recover half max hit dice (min 1),
   * all spell slots, all short/long rest features.
   */
  longRest(character: Character): {
    hpHealed: number;
    hitDiceRecovered: number;
    spellSlotsRecovered: boolean;
    featuresRecharged: string[];
  } {
    const hpBefore = character.currentHp;

    // Full HP
    character.currentHp = character.maxHp;
    character.tempHp = 0;
    const hpHealed = character.maxHp - hpBefore;

    // Recover half hit dice (min 1)
    const hitDiceToRecover = Math.max(1, Math.floor(character.hitDice.max / 2));
    const recovered = Math.min(
      hitDiceToRecover,
      character.hitDice.max - character.hitDice.current,
    );
    character.hitDice.current += recovered;

    // Recover all spell slots
    let spellSlotsRecovered = false;
    if (character.spellcasting) {
      for (const slotLevel of Object.keys(character.spellcasting.spellSlots)) {
        const level = Number(slotLevel);
        const slot = character.spellcasting.spellSlots[level];
        if (slot.current < slot.max) {
          spellSlotsRecovered = true;
        }
        slot.current = slot.max;
      }
    }

    // Recharge all features (both short and long rest)
    const recharged: string[] = [];
    for (const feature of character.features) {
      if (
        (feature.rechargeOn === 'shortRest' || feature.rechargeOn === 'longRest') &&
        feature.usesMax !== undefined
      ) {
        feature.usesRemaining = feature.usesMax;
        recharged.push(feature.name);
      }
    }

    // Clear death saves
    character.deathSaves = { successes: 0, failures: 0 };

    // Remove unconscious condition if present
    character.conditions = character.conditions.filter((c) => c.type !== 'unconscious');

    return {
      hpHealed: Math.max(0, hpHealed),
      hitDiceRecovered: recovered,
      spellSlotsRecovered,
      featuresRecharged: recharged,
    };
  }
}
