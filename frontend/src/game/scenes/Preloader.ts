import { Scene } from 'phaser'

export class Preloader extends Scene {
  constructor() {
    super('Preloader')
  }

  init() {
    const { width, height } = this.scale

    // 进度条背景
    this.add.rectangle(width / 2, height / 2, 468, 32).setStrokeStyle(1, 0xffffff)

    // 进度条
    const bar = this.add.rectangle(width / 2 - 230, height / 2, 4, 28, 0xffffff)

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + 460 * progress
    })
  }

  preload() {
    // 加载游戏资源
    this.load.setPath('assets')
    // TODO: 加载塔防游戏资源
  }

  create() {
    this.scene.start('Game')
  }
}
