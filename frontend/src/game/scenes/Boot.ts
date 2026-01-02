import { Scene } from 'phaser'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    // 加载 Preloader 场景所需的最小资源
  }

  create() {
    this.scene.start('Preloader')
  }
}
