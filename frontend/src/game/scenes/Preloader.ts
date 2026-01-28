import { Scene } from 'phaser'

export class Preloader extends Scene {
  constructor() {
    super('Preloader')
  }

  init() {
    const { width, height } = this.scale

    // Progress bar background
    this.add.rectangle(width / 2, height / 2, 468, 32).setStrokeStyle(1, 0xffffff)

    // Progress bar
    const bar = this.add.rectangle(width / 2 - 230, height / 2, 4, 28, 0xffffff)

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + 460 * progress
    })
  }

  preload() {
    // Load game assets
    this.load.setPath('assets')
    // TODO: Load tower defense game assets
  }

  create() {
    this.scene.start('Game')
  }
}
