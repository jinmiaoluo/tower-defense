import { Scene } from 'phaser'
import { EventBus } from '../EventBus'

export class Game extends Scene {
  constructor() {
    super('Game')
  }

  create() {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2, 'Tower Defense', {
        fontFamily: 'Arial Black',
        fontSize: 48,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8
      })
      .setOrigin(0.5)

    EventBus.emit('current-scene-ready', this)
  }
}
