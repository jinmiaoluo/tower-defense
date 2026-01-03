/**
 * ScoreSystem - 得分计算系统
 * 负责命中得分和最终得分的计算
 * 参考文档：docs/SPEC.md 得分计算章节
 * 参考旧实现：html5-tower-defense/src/js/td-obj-monster.js:85
 */

import { GAME_CONSTANTS } from '@/types'

/** 最终得分计算输入参数 */
export interface FinalScoreInput {
  /** 累计命中得分（每次攻击命中时累加的得分） */
  accumulatedScore: number
  /** 完成的波次数 */
  wavesCompleted: number
  /** 剩余生命值 */
  remainingLife: number
  /** 剩余金币 */
  remainingMoney: number
}

/** 最终得分明细 */
export interface FinalScoreBreakdown {
  /** 累计命中得分 */
  hitScore: number
  /** 波次奖励 */
  waveBonus: number
  /** 生命奖励 */
  lifeBonus: number
  /** 金币奖励 */
  moneyBonus: number
  /** 总分 */
  total: number
}

/** ScoreSystem 接口定义 */
export interface ScoreSystem {
  /**
   * 计算单次命中得分
   * 公式: score = floor(sqrt(actualDamage))
   * @param actualDamage 实际伤害值（已扣除护盾后）
   * @returns 得分
   */
  calculateHitScore(actualDamage: number): number

  /**
   * 计算多次攻击的总命中得分
   * @param damages 每次攻击的实际伤害数组
   * @returns 总得分
   */
  calculateTotalHitScore(damages: number[]): number

  /**
   * 计算波次奖励
   * 公式: waveBonus = wavesCompleted x SCORE_WAVE_COEFFICIENT
   * @param wavesCompleted 完成的波次数
   * @returns 波次奖励分数
   */
  calculateWaveBonus(wavesCompleted: number): number

  /**
   * 计算剩余生命奖励
   * 公式: lifeBonus = remainingLife x SCORE_LIFE_COEFFICIENT
   * @param remainingLife 剩余生命值
   * @returns 生命奖励分数
   */
  calculateLifeBonus(remainingLife: number): number

  /**
   * 计算剩余金币奖励
   * 公式: moneyBonus = floor(remainingMoney x SCORE_MONEY_COEFFICIENT)
   * @param remainingMoney 剩余金币
   * @returns 金币奖励分数
   */
  calculateMoneyBonus(remainingMoney: number): number

  /**
   * 计算最终得分
   * 公式: finalScore = accumulatedScore + waveBonus + lifeBonus + moneyBonus
   * @param input 最终得分计算输入
   * @returns 最终得分
   */
  calculateFinalScore(input: FinalScoreInput): number

  /**
   * 获取最终得分明细
   * 返回各项得分的详细分解
   * @param input 最终得分计算输入
   * @returns 得分明细
   */
  getFinalScoreBreakdown(input: FinalScoreInput): FinalScoreBreakdown
}

/**
 * 创建 ScoreSystem 实例
 */
export function createScoreSystem(): ScoreSystem {
  const {
    SCORE_WAVE_COEFFICIENT,
    SCORE_LIFE_COEFFICIENT,
    SCORE_MONEY_COEFFICIENT,
  } = GAME_CONSTANTS

  /**
   * 计算单次命中得分
   * 参考旧实现：TD.score += Math.floor(Math.sqrt(damage))
   */
  function calculateHitScore(actualDamage: number): number {
    return Math.floor(Math.sqrt(actualDamage))
  }

  /**
   * 计算多次攻击的总命中得分
   */
  function calculateTotalHitScore(damages: number[]): number {
    return damages.reduce((total, damage) => total + calculateHitScore(damage), 0)
  }

  /**
   * 计算波次奖励
   */
  function calculateWaveBonus(wavesCompleted: number): number {
    return wavesCompleted * SCORE_WAVE_COEFFICIENT
  }

  /**
   * 计算剩余生命奖励
   */
  function calculateLifeBonus(remainingLife: number): number {
    return remainingLife * SCORE_LIFE_COEFFICIENT
  }

  /**
   * 计算剩余金币奖励
   * 金币奖励需要向下取整
   */
  function calculateMoneyBonus(remainingMoney: number): number {
    return Math.floor(remainingMoney * SCORE_MONEY_COEFFICIENT)
  }

  /**
   * 计算最终得分
   */
  function calculateFinalScore(input: FinalScoreInput): number {
    const { accumulatedScore, wavesCompleted, remainingLife, remainingMoney } = input
    return (
      accumulatedScore +
      calculateWaveBonus(wavesCompleted) +
      calculateLifeBonus(remainingLife) +
      calculateMoneyBonus(remainingMoney)
    )
  }

  /**
   * 获取最终得分明细
   */
  function getFinalScoreBreakdown(input: FinalScoreInput): FinalScoreBreakdown {
    const { accumulatedScore, wavesCompleted, remainingLife, remainingMoney } = input
    const hitScore = accumulatedScore
    const waveBonus = calculateWaveBonus(wavesCompleted)
    const lifeBonus = calculateLifeBonus(remainingLife)
    const moneyBonus = calculateMoneyBonus(remainingMoney)
    const total = hitScore + waveBonus + lifeBonus + moneyBonus

    return {
      hitScore,
      waveBonus,
      lifeBonus,
      moneyBonus,
      total,
    }
  }

  return {
    calculateHitScore,
    calculateTotalHitScore,
    calculateWaveBonus,
    calculateLifeBonus,
    calculateMoneyBonus,
    calculateFinalScore,
    getFinalScoreBreakdown,
  }
}
