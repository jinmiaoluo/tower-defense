/**
 * WaveRecorder - 波次记录器
 * 负责记录每波次的所有操作、攻击事件和战斗结果
 * 用于提交给服务端进行验证
 */

import type {
  Action,
  AttackEvent,
  AttackRecordData,
  BuildActionData,
  BuildingSnapshot,
  IWaveRecorder,
  KillRecordData,
  MutableWaveResult,
  PassedRecordData,
  SellActionData,
  UpgradeActionData,
  WaveRequest,
  WaveResult,
} from '@/types'
import { createEmptyMutableResult, toImmutableResult } from '@/types'

/** WaveRecorder 类型别名 */
export type WaveRecorder = IWaveRecorder

/**
 * 创建波次记录器
 * @param waveNumber 波次号
 * @param startFrame 起始帧号
 */
export function createWaveRecorder(waveNumber: number, startFrame: number): WaveRecorder {
  let currentWaveNumber = waveNumber
  let currentStartFrame = startFrame
  let actions: Action[] = []
  let attacks: AttackEvent[] = []
  let result: MutableWaveResult = createEmptyMutableResult()
  let waveDurationFrames = 0

  /**
   * 记录建造操作
   */
  function recordBuild(data: BuildActionData): void {
    actions.push({
      type: 'BUILD',
      buildingId: data.buildingId,
      buildingType: data.buildingType,
      position: data.position,
      frame: data.frame,
    })
  }

  /**
   * 记录升级操作
   */
  function recordUpgrade(data: UpgradeActionData): void {
    actions.push({
      type: 'UPGRADE',
      buildingId: data.buildingId,
      level: data.level,
      frame: data.frame,
    })
  }

  /**
   * 记录出售操作
   */
  function recordSell(data: SellActionData): void {
    actions.push({
      type: 'SELL',
      buildingId: data.buildingId,
      frame: data.frame,
    })
  }

  /**
   * 记录攻击事件
   * 同时累加伤害和得分
   */
  function recordAttack(data: AttackRecordData): void {
    attacks.push({
      frame: data.frame,
      buildingId: data.buildingId,
      originalTargetId: data.originalTargetId,
      originalTargetPosition: data.originalTargetPosition,
      monsterId: data.monsterId,
      monsterPosition: data.monsterPosition,
      damage: data.damage,
    })

    // 累加总伤害
    result.totalDamageDealt += data.damage

    // 累加得分: score = floor(sqrt(damage))
    result.scoreGained += Math.floor(Math.sqrt(data.damage))
  }

  /**
   * 记录怪物被击杀
   */
  function recordKill(data: KillRecordData): void {
    result.killed += 1

    // 累加 killedByType
    const currentCount = result.killedByType.get(data.monsterType) || 0
    result.killedByType.set(data.monsterType, currentCount + 1)

    // 累加金钱
    result.moneyGained += data.money

    // 累加击杀的总生命值
    result.totalLifeDestroyed += data.monsterLife
  }

  /**
   * 记录怪物穿过终点
   */
  function recordPassed(data: PassedRecordData): void {
    result.passed += 1
    result.lifeLost += data.damage
  }

  /**
   * 设置波次持续帧数
   * @param currentFrame 当前绝对帧号，内部会计算相对于波次开始的持续时间
   */
  function setDuration(currentFrame: number): void {
    waveDurationFrames = currentFrame - currentStartFrame
  }

  /**
   * 获取所有操作
   */
  function getActions(): Action[] {
    return [...actions]
  }

  /**
   * 获取所有攻击事件
   */
  function getAttacks(): AttackEvent[] {
    return [...attacks]
  }

  /**
   * 获取波次结果
   */
  function getResult(): WaveResult {
    return toImmutableResult(result, waveDurationFrames)
  }

  /**
   * 导出为 WaveRequest 格式
   */
  function toWaveRequest(sessionId: string, buildings: BuildingSnapshot[]): WaveRequest {
    return {
      sessionId,
      waveNumber: currentWaveNumber,
      actions: getActions(),
      attacks: getAttacks(),
      result: getResult(),
      buildings,
    }
  }

  /**
   * 重置记录器
   */
  function reset(newWaveNumber: number, newStartFrame: number): void {
    currentWaveNumber = newWaveNumber
    currentStartFrame = newStartFrame
    actions = []
    attacks = []
    result = createEmptyMutableResult()
    waveDurationFrames = 0
  }

  return {
    recordBuild,
    recordUpgrade,
    recordSell,
    recordAttack,
    recordKill,
    recordPassed,
    setDuration,
    getActions,
    getAttacks,
    getResult,
    toWaveRequest,
    reset,
  }
}
